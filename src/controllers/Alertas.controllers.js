import { getConnection } from "../database/connection.js";
import sql from 'mssql';

export const createAlerta = async (req, res) => {
  try {
    const { id_insumo, tipo } = req.body;

    const pool = await getConnection();

    const insumo = await pool.request()
        .input('id_insumo', sql.Int, id_insumo)
        .query(`
          SELECT nombre, stock_actual, stock_minimo, stock_maximo
          FROM Insumos
          WHERE id_insumo = @id_insumo
        `);

    if (insumo.recordset.length === 0) {
      return res.status(404).json({ message: "Insumo no encontrado" });
    }

    const { nombre, stock_actual, stock_minimo, stock_maximo } = insumo.recordset[0];

    let mensaje;
    switch (tipo) {
      case 'stock_bajo':
        mensaje = `Stock bajo para ${nombre}: ${stock_actual} < ${stock_minimo}`;
        break;
      case 'stock_excedido':
        mensaje = `Stock excedido para ${nombre}: ${stock_actual} > ${stock_maximo}`;
        break;
      default:
        return res.status(400).json({ message: "Tipo de alerta inválido" });
    }

    const result = await pool.request()
        .input('id_insumo', sql.Int, id_insumo)
        .input('mensaje', sql.Text, mensaje)
        .input('tipo', sql.VarChar(50), tipo)
        .input('estado', sql.VarChar(20), 'Activa')
        .query(`
        INSERT INTO Alertas (id_insumo, mensaje, tipo, estado)
        OUTPUT INSERTED.id_alerta
        VALUES (@id_insumo, @mensaje, @tipo, @estado)
      `);

    res.status(201).json({
      id_alerta: result.recordset[0].id_alerta,
      id_insumo,
      mensaje,
      tipo,
      estado: 'Activa',
      fecha: new Date().toISOString()
    });

  } catch (error) {
    console.error("Error al crear alerta:", error);
    res.status(500).json({
      message: "Error al crear alerta",
      error: error.message
    });
  }
};

export const getAlertas = async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT 
        A.id_alerta,
        A.mensaje,
        A.tipo,
        A.estado,
        A.fecha,
        I.nombre AS insumo_nombre,
        I.stock_actual,
        I.stock_minimo,
        I.stock_maximo
      FROM Alertas A
      INNER JOIN Insumos I ON A.id_insumo = I.id_insumo
    `);

    res.json(result.recordset.map(a => ({
      ...a,
      fecha: new Date(a.fecha).toISOString()
    })));

  } catch (error) {
    console.error("Error al obtener alertas:", error);
    res.status(500).json({
      message: "Error al obtener alertas",
      error: error.message
    });
  }
};
