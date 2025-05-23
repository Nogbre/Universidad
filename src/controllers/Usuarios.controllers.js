import { getConnection } from '../database/connection.js';
import sql from 'mssql';

export const getAllUsersConsolidated = async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request().query(`
            SELECT 
                d.id_docente,
                d.nombre as nombre_docente,
                d.apellido as apellido_docente,
                d.correo as correo_docente,
                d.id_carrera,
                e.id_estudiante,
                e.nombre as nombre_estudiante,
                e.apellido as apellido_estudiante,
                e.correo as correo_estudiante,
                e.facultad,
                e.id_materia,
                el.id_encargado,
                el.nombre as nombre_encargado,
                el.apellido as apellido_encargado,
                el.correo as correo_encargado
            FROM Docentes d
            LEFT JOIN Estudiantes e ON e.id_estudiante = d.id_docente
            LEFT JOIN EncargadoLaboratorio el ON el.id_encargado = d.id_docente
        `);
        
        // Transformar los resultados en una estructura más limpia
        const usuariosConsolidados = result.recordset.map(record => ({
            docente: {
                id: record.id_docente,
                nombre: record.nombre_docente,
                apellido: record.apellido_docente,
                correo: record.correo_docente,
                id_carrera: record.id_carrera
            },
            estudiante: record.id_estudiante ? {
                id: record.id_estudiante,
                nombre: record.nombre_estudiante,
                apellido: record.apellido_estudiante,
                correo: record.correo_estudiante,
                facultad: record.facultad,
                id_materia: record.id_materia
            } : null,
            encargado: record.id_encargado ? {
                id: record.id_encargado,
                nombre: record.nombre_encargado,
                apellido: record.apellido_encargado,
                correo: record.correo_encargado,
            } : null
        }));

        res.json(usuariosConsolidados);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener usuarios consolidados', error: error.message });
    }
};

export const getUsersByType = async (req, res) => {
    try {
        const { tipo } = req.params;
        const pool = await getConnection();
        let query = '';

        const tipoVar = tipo.toLowerCase();
        if (tipoVar === 'encargados') {
            query = `
                SELECT 
                    id_encargado as id,
                    nombre,
                    apellido,
                    correo
                FROM EncargadoLaboratorio
            `;
        } else if (tipoVar === 'estudiantes') {
            query = `
                SELECT 
                    id_estudiante as id,
                    nombre,
                    apellido,
                    correo,
                    facultad,
                    id_materia
                FROM Estudiantes
            `;
        } else if (tipoVar === 'docentes') {
            query = `
                SELECT 
                    id_docente as id,
                    nombre,
                    apellido,
                    correo,
                    id_carrera
                FROM Docentes
            `;
        } else {
            return res.status(400).json({ 
                message: 'Tipo de usuario no válido. Use: docentes, estudiantes o encargados' 
            });
        }

        // ✅ Ejecutar la consulta una sola vez después de definir el query
        const result = await pool.request().query(query);
        res.json(result.recordset);

    } catch (error) {
        res.status(500).json({ 
            message: `Error al obtener usuarios de tipo ${req.params.tipo}`, 
            error: error.message 
        });
    }
};
