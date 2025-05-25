import { getConnection } from "../database/connection.js";
import sql from 'mssql';

export const createAula = async (req, res) => {
    try {
        const { nombre_aula, encargado_id } = req.body;

        if (!nombre_aula || !encargado_id) {
            return res.status(400).json({
                message: "Nombre del aula y ID del encargado son requeridos"
            });
        }

        const pool = await getConnection();

        const encargadoExists = await pool.request()
            .input('encargado_id', sql.Int, encargado_id)
            .query('SELECT 1 FROM EncargadoLaboratorio WHERE id_encargado = @encargado_id');

        if (!encargadoExists.recordset.length) {
            return res.status(404).json({ message: "Encargado no encontrado" });
        }

        const result = await pool.request()
            .input('nombre_aula', sql.VarChar(100), nombre_aula)
            .input('encargado_id', sql.Int, encargado_id)
            .query(`
                INSERT INTO aulaLaboratorio (nombre_aula, encargado_id)
                OUTPUT INSERTED.id_aula
                VALUES (@nombre_aula, @encargado_id)
            `);

        res.status(201).json({
            id_aula: result.recordset[0].id_aula,
            message: "Aula creada exitosamente"
        });

    } catch (error) {
        console.error('Error al crear aula:', error);
        res.status(500).json({
            message: "Error interno del servidor",
            error: error.message
        });
    }
};

export const getAulas = async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .query(`
                SELECT 
                    a.id_aula,
                    a.nombre_aula,
                    e.nombre + ' ' + e.apellido as encargado
                FROM aulaLaboratorio a
                JOIN EncargadoLaboratorio e ON a.encargado_id = e.id_encargado
            `);

        res.json(result.recordset);
    } catch (error) {
        console.error('Error al obtener aulas:', error);
        res.status(500).json({ message: "Error al obtener aulas" });
    }
};

export const getAulaById = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getConnection();

        const result = await pool.request()
            .input('id', sql.Int, id)
            .query(`
                SELECT 
                    a.id_aula,
                    a.nombre_aula,
                    e.id_encargado,
                    e.nombre + ' ' + e.apellido as encargado
                FROM aulaLaboratorio a
                JOIN EncargadoLaboratorio e ON a.encargado_id = e.id_encargado
                WHERE a.id_aula = @id
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ message: "Aula no encontrada" });
        }

        res.json(result.recordset[0]);
    } catch (error) {
        console.error('Error al obtener aula:', error);
        res.status(500).json({ message: "Error al obtener aula" });
    }
};

export const updateAula = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre_aula, encargado_id } = req.body;

        if (!nombre_aula || !encargado_id) {
            return res.status(400).json({
                message: "Todos los campos son requeridos"
            });
        }

        const pool = await getConnection();

        const aulaExists = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT 1 FROM aulaLaboratorio WHERE id_aula = @id');

        if (!aulaExists.recordset.length) {
            return res.status(404).json({ message: "Aula no encontrada" });
        }

        const encargadoExists = await pool.request()
            .input('encargado_id', sql.Int, encargado_id)
            .query('SELECT 1 FROM EncargadoLaboratorio WHERE id_encargado = @encargado_id');

        if (!encargadoExists.recordset.length) {
            return res.status(404).json({ message: "Encargado no encontrado" });
        }

        await pool.request()
            .input('id', sql.Int, id)
            .input('nombre_aula', sql.VarChar(100), nombre_aula)
            .input('encargado_id', sql.Int, encargado_id)
            .query(`
                UPDATE aulaLaboratorio
                SET 
                    nombre_aula = @nombre_aula,
                    encargado_id = @encargado_id
                WHERE id_aula = @id
            `);

        res.json({ message: "Aula actualizada exitosamente" });

    } catch (error) {
        console.error('Error al actualizar aula:', error);
        res.status(500).json({
            message: "Error interno del servidor",
            error: error.message
        });
    }
};

export const deleteAula = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getConnection();

        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM aulaLaboratorio WHERE id_aula = @id');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ message: "Aula no encontrada" });
        }

        res.json({ message: "Aula eliminada exitosamente" });
    } catch (error) {
        console.error('Error al eliminar aula:', error);
        res.status(500).json({
            message: "Error interno del servidor",
            error: error.message
        });
    }
};