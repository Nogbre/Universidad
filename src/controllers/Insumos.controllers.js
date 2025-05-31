import { request } from "express";
import { getConnection } from "../database/connection.js";
import sql from 'mssql';
import {gestionarAlertasInsumo} from "../helpers/alertas.js";

//las consultas a la base de datos van en la carpeta model

//get general
export const getInsumos = async (req, res) => {
    const pool = await getConnection()
    const result = await pool.request().query('SELECT * FROM Insumos')
    res.json(result.recordset)
}

//get individual

export const getInsumo = async (req, res) => {
    console.log(req.params.id)

    const pool = await getConnection()
    const result = await pool.request()
        .input('id', sql.Int, req.params.id)
        .query('SELECT * FROM Insumos WHERE id_insumo = @id')

    if (result.rowsAffected[0] === 0) {
        return res.status(404).json({
            message: "Insumo not found"
        });
    }
    return res.json(result.recordset[0]);
}


//post /////////////////////////////


export const createInsumo = async (req, res) => {
    console.log(req.body)

    const pool = await getConnection()
    const result = await pool.request()
        .input('nombre', sql.VarChar, req.body.nombre)
        .input('descripcion', sql.Text, req.body.descripcion)
        .input('ubicacion', sql.VarChar, req.body.ubicacion)
        .input('tipo', sql.VarChar, req.body.tipo)
        .input('unidad_medida', sql.VarChar, req.body.unidad_medida)
        .input('stock_actual', sql.Int, req.body.stock_actual)
        .input('stock_minimo', sql.Int, req.body.stock_minimo)
        .input('stock_maximo', sql.Int, req.body.stock_maximo)
        .query(
            'INSERT INTO Insumos (nombre, descripcion,ubicacion,tipo,unidad_medida, stock_actual, stock_minimo, stock_maximo) VALUES (@nombre, @descripcion,@ubicacion,@tipo, @unidad_medida, @stock_actual, @stock_minimo, @stock_maximo); SELECT SCOPE_IDENTITY() AS id;');
    console.log(result)

    res.json({
        id: result.recordset[0].id,
        nombre: req.body.nombre,
        descripcion: req.body.descripcion,
        ubicacion: req.body.ubicacion,
        tipo:req.body.tipo,
        unidad_medida: req.body.unidad_medida,
        stock_actual: req.body.stock_actual,
        stock_minimo: req.body.stock_minimo,
        stock_maximo: req.body.stock_minimo
    })
    const newInsumoId = result.recordset[0].id;
    await gestionarAlertasInsumo(newInsumoId);

}

//////////////////////////////

export const updateInsumo = async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('nombre', sql.VarChar, req.body.nombre)
            .input('descripcion', sql.Text, req.body.descripcion)
            .input('ubicacion', sql.VarChar, req.body.ubicacion)
            .input('tipo', sql.VarChar, req.body.tipo)
            .input('unidad_medida', sql.VarChar, req.body.unidad_medida)
            .input('stock_actual', sql.Int, req.body.stock_actual)
            .input('stock_minimo', sql.Int, req.body.stock_minimo)
            .input('stock_maximo', sql.Int, req.body.stock_maximo)
            .query(`UPDATE Insumos SET 
                   nombre = @nombre, 
                   descripcion = @descripcion,
                   ubicacion = @ubicacion, 
                   tipo = @tipo, 
                   unidad_medida = @unidad_medida, 
                   stock_actual = @stock_actual,
                   stock_minimo = @stock_minimo, 
                   stock_maximo = @stock_maximo 
                   WHERE id_insumo = @id`);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ message: "Insumo no encontrado" });
        }

        res.json({
            id: req.params.id,
            nombre: req.body.nombre,
            descripcion: req.body.descripcion,
            ubicacion: req.body.ubicacion,
            tipo: req.body.tipo,
            unidad_medida: req.body.unidad_medida,
            stock_actual: req.body.stock_actual,
            stock_minimo: req.body.stock_minimo,
            stock_maximo: req.body.stock_maximo
        });
        await gestionarAlertasInsumo(req.params.id);
    } catch (error) {
        console.error('Error al actualizar insumo:', error);
        res.status(500).json({ message: "Error interno del servidor" });
    }
};


////////////////////////////////


// export const deleteInsumo = async (req, res) => {
//     const pool = await getConnection();
//     try {
//         const result = await pool.request()
//             .input("id", sql.Int, req.params.id)
//             .query("DELETE FROM Insumos WHERE id_insumo = @id");

//         if (result.rowsAffected[0] === 0) {
//             return res.status(404).json({ message: "Insumo no encontrado" });
//         }
//         return res.json({ message: "Insumo eliminado correctamente" });
//     } catch (error) {
//         console.error('Error al eliminar insumo:', error);
//         res.status(500).json({ message: "Error interno del servidor" });
//     }
// };

export const deleteInsumo = async (req, res) => {
  const pool = await getConnection();
  const id = req.params.id;
  try {
    // 1) Eliminar alertas hijas
    await pool.request()
      .input("id", sql.Int, id)
      .query("DELETE FROM Alertas WHERE id_insumo = @id");

    // 2) Ahora sí borrar el insumo
    const result = await pool.request()
      .input("id", sql.Int, id)
      .query("DELETE FROM Insumos WHERE id_insumo = @id");

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: "Insumo no encontrado" });
    }
    return res.json({ message: "Insumo eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar insumo o alertas:", error.number, error.message);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const getInsumosPorUbicacion = async (req, res) => {
    try {
        const { ubicacion } = req.params;
        const pool = await getConnection();
        const result = await pool.request()
            .input('ubicacion', sql.VarChar(50), ubicacion)
            .query('SELECT * FROM Insumos WHERE ubicacion = @ubicacion');

        res.json(result.recordset);
    } catch (error) {
        console.error('Error al obtener insumos por ubicación:', error);
        res.status(500).json({ message: "Error al obtener insumos" });
    }
};


export const getInsumosEnUsoPorEncargado = async (req, res) => {
  const { id_encargado } = req.query;

  if (!id_encargado) {
    return res.status(400).json({ message: "id_encargado es requerido" });
  }

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('id_encargado', sql.Int, id_encargado)
      .query(`
        SELECT 
          i.id_insumo,
          i.nombre AS insumo_nombre,
          dsu.cantidad_total,
          l.nombre AS laboratorio_nombre,
          s.id_solicitud
        FROM SolicitudesUso s
        JOIN DetalleSolicitudUso dsu ON s.id_solicitud = dsu.id_solicitud
        JOIN Insumos i ON dsu.id_insumo = i.id_insumo
        JOIN Laboratorios l ON s.id_laboratorio = l.id_laboratorio
        WHERE s.estado = 'Aprobada' AND l.id_encargado = @id_encargado
      `);

    res.json(result.recordset);
  } catch (error) {
    console.error('Error al obtener insumos en uso:', error);
    res.status(500).json({ message: 'Error al obtener insumos en uso' });
  }
};

export const iniciarMantenimiento = async (req, res) => {
    const pool = await getConnection();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        const { id_insumo, cantidad, observaciones } = req.body;

        // Validaciones
        if (!id_insumo || !cantidad || cantidad <= 0) {
            await transaction.rollback();
            return res.status(400).json({
                message: "id_insumo y cantidad (positiva) son obligatorios"
            });
        }

        // Verificar stock disponible
        const insumo = await new sql.Request(transaction)
            .input('id_insumo', sql.Int, id_insumo)
            .query('SELECT stock_actual FROM Insumos WHERE id_insumo = @id_insumo');

        if (!insumo.recordset.length) {
            await transaction.rollback();
            return res.status(404).json({ message: "Insumo no encontrado" });
        }

        const stockActual = insumo.recordset[0].stock_actual;
        if (stockActual < cantidad) {
            await transaction.rollback();
            return res.status(400).json({
                message: "Stock insuficiente",
                stock_actual: stockActual,
                cantidad_solicitada: cantidad
            });
        }

        // Descontar del stock
        await new sql.Request(transaction)
            .input('id_insumo', sql.Int, id_insumo)
            .input('cantidad', sql.Int, cantidad)
            .query('UPDATE Insumos SET stock_actual = stock_actual - @cantidad WHERE id_insumo = @id_insumo');

        // Registrar mantenimiento
        const result = await new sql.Request(transaction)
            .input('id_insumo', sql.Int, id_insumo)
            .input('cantidad', sql.Int, cantidad)
            .input('observaciones', sql.Text, observaciones)
            .query(`
                INSERT INTO MantenimientosInsumos (id_insumo, cantidad, observaciones)
                OUTPUT INSERTED.id_mantenimiento
                VALUES (@id_insumo, @cantidad, @observaciones)
            `);

        await transaction.commit();

        res.status(201).json({
            id_mantenimiento: result.recordset[0].id_mantenimiento,
            message: "Mantenimiento iniciado correctamente"
        });

    } catch (error) {
        await transaction.rollback();
        console.error("Error al iniciar mantenimiento:", error);
        res.status(500).json({
            message: "Error al iniciar mantenimiento",
            error: error.message
        });
    }
};

export const finalizarMantenimiento = async (req, res) => {
    const pool = await getConnection();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        const { id } = req.params;
        const { cantidad_devolver } = req.body;

        // Obtener mantenimiento
        const mantenimiento = await new sql.Request(transaction)
            .input('id', sql.Int, id)
            .query(`
                SELECT id_insumo, cantidad, estado 
                FROM MantenimientosInsumos 
                WHERE id_mantenimiento = @id
            `);

        if (!mantenimiento.recordset.length) {
            await transaction.rollback();
            return res.status(404).json({ message: "Mantenimiento no encontrado" });
        }

        const { id_insumo, cantidad, estado } = mantenimiento.recordset[0];

        // Validar estado
        if (estado !== 'En Mantenimiento') {
            await transaction.rollback();
            return res.status(400).json({
                message: "El mantenimiento no está activo"
            });
        }

        // Calcular cantidad a devolver (si no se especifica, devolver todo)
        const cantidadDevolver = cantidad_devolver || cantidad;
        if (cantidadDevolver > cantidad) {
            await transaction.rollback();
            return res.status(400).json({
                message: "Cantidad a devolver excede la cantidad en mantenimiento"
            });
        }

        // Actualizar stock
        await new sql.Request(transaction)
            .input('id_insumo', sql.Int, id_insumo)
            .input('cantidad', sql.Int, cantidadDevolver)
            .query('UPDATE Insumos SET stock_actual = stock_actual + @cantidad WHERE id_insumo = @id_insumo');

        // Actualizar mantenimiento
        await new sql.Request(transaction)
            .input('id', sql.Int, id)
            .input('fecha_fin', sql.DateTime, new Date())
            .input('estado', sql.VarChar(20), 'Finalizado')
            .query(`
                UPDATE MantenimientosInsumos 
                SET fecha_fin = @fecha_fin, estado = @estado 
                WHERE id_mantenimiento = @id
            `);

        await transaction.commit();

        res.json({
            message: "Mantenimiento finalizado correctamente",
            cantidad_devuelta: cantidadDevolver
        });

    } catch (error) {
        await transaction.rollback();
        console.error("Error al finalizar mantenimiento:", error);
        res.status(500).json({
            message: "Error al finalizar mantenimiento",
            error: error.message
        });
    }
};

export const getMantenimientosActivos = async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request().query(`
            SELECT m.*, i.nombre as insumo_nombre 
            FROM MantenimientosInsumos m
            JOIN Insumos i ON m.id_insumo = i.id_insumo
            WHERE m.estado = 'En Mantenimiento'
        `);
        res.json(result.recordset);
    } catch (error) {
        console.error("Error al obtener mantenimientos activos:", error);
        res.status(500).json({
            message: "Error al obtener mantenimientos activos",
            error: error.message
        });
    }
};

export const getHistorialMantenimientos = async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request().query(`
            SELECT m.*, i.nombre as insumo_nombre 
            FROM MantenimientosInsumos m
            JOIN Insumos i ON m.id_insumo = i.id_insumo
            ORDER BY m.fecha_inicio DESC
        `);
        res.json(result.recordset);
    } catch (error) {
        console.error("Error al obtener historial de mantenimientos:", error);
        res.status(500).json({
            message: "Error al obtener historial de mantenimientos",
            error: error.message
        });
    }
};

