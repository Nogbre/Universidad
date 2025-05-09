import { getConnection } from "../database/connection.js";
import sql from 'mssql';

export const createSolicitud = async (req, res) => {
  try {
    const { nombre_solicitud, cantidad_solicitada, estado, observaciones } = req.body;

    const pool = await getConnection();
    const result = await pool.request()
        .input('nombre_solicitud', sql.VarChar(50), nombre_solicitud)
        .input('cantidad_solicitada', sql.Int, cantidad_solicitada)
        .input('estado', sql.VarChar(30), estado)
        .input('observaciones', sql.Text, observaciones || '')
        .query(`
          INSERT INTO SolicitudesAdquisicion (nombre_solicitud, cantidad_solicitada, estado, observaciones)
          VALUES (@nombre_solicitud, @cantidad_solicitada, @estado, @observaciones);
          SELECT SCOPE_IDENTITY() AS id;
        `);

    res.status(201).json({
      id_solicitud: result.recordset[0].id,
      nombre_solicitud,
      cantidad_solicitada,
      estado,
      observaciones
    });

  } catch (error) {
    console.error("Error al crear solicitud:", error);
    res.status(500).json({ message: "Error al crear la solicitud" });
  }
};

export const getSolicitudes = async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request().query('SELECT * FROM SolicitudesAdquisicion');
    res.json(result.recordset);
  } catch (error) {
    console.error("Error al obtener solicitudes:", error);
    res.status(500).json({ message: "Error al obtener solicitudes" });
  }
};

export const getSolicitud = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await getConnection();
    const result = await pool.request()
        .input('id', sql.Int, id)
        .query('SELECT * FROM SolicitudesAdquisicion WHERE id = @id');

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Solicitud no encontrada" });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    console.error("Error al obtener solicitud:", error);
    res.status(500).json({ message: "Error al obtener solicitud" });
  }
};

export const updateSolicitud = async (req, res) => {
  const { id } = req.params;
  const { estado, nombre_solicitud } = req.body;

  if (!id || isNaN(id)) {
    return res.status(400).json({ message: "ID inválido" });
  }

  if (!estado) {
    return res.status(400).json({ message: "El campo 'estado' es obligatorio" });
  }

  try {
    const pool = await getConnection();

    const existing = await pool.request()
        .input('id_solicitud', sql.Int, id)
        .query(`
        SELECT estado, nombre_solicitud 
        FROM SolicitudesAdquisicion 
        WHERE id_solicitud = @id_solicitud
      `);

    if (existing.recordset.length === 0) {
      return res.status(404).json({ message: "Solicitud no encontrada" });
    }

    const actual = existing.recordset[0];

    const nombreNuevo = nombre_solicitud ?? actual.nombre_solicitud;
    const estadoNuevo = estado ?? actual.estado;

    if (actual.estado === estadoNuevo && actual.nombre_solicitud === nombreNuevo) {
      return res.status(200).json({ message: "No se realizaron cambios" });
    }

    await pool.request()
        .input('id_solicitud', sql.Int, id)
        .input('estado', sql.VarChar(30), estadoNuevo)
        .input('nombre_solicitud', sql.VarChar(50), nombreNuevo)
        .query(`
        UPDATE SolicitudesAdquisicion 
        SET estado = @estado, nombre_solicitud = @nombre_solicitud 
        WHERE id_solicitud = @id_solicitud
      `);

    res.json({ message: "Solicitud actualizada correctamente" });

  } catch (error) {
    console.error("Error al actualizar solicitud:", error);
    res.status(500).json({ message: "Error al actualizar solicitud" });
  }
};

export const deleteSolicitud = async (req, res) => {
  const { id } = req.params;

  if (!id || isNaN(id)) {
    return res.status(400).json({ message: "ID inválido" });
  }

  try {
    const pool = await getConnection();
    const result = await pool.request()
        .input('id_solicitud', sql.Int, id)
        .query('DELETE FROM SolicitudesAdquisicion WHERE id_solicitud = @id_solicitud');

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: "Solicitud no encontrada" });
    }

    return res.status(200).json({ message: "Solicitud eliminada correctamente" });
  } catch (error) {
    console.error("Error al eliminar solicitud:", error);
    return res.status(500).json({ message: "Error del servidor al eliminar la solicitud" });
  }
};




