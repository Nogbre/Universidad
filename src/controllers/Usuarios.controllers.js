import { getConnection } from '../database/connection.js';
import sql from 'mssql';
import jwt from 'jsonwebtoken';

const saltRounds = 10;

export const getAllUsers = async (req, res) => {
    try {
        const pool = await getConnection();

        const docentesResult = await pool.request()
            .query(`
                SELECT 
                    id_docente as id,
                    nombre,
                    apellido,
                    correo,
                    id_carrera,
                    'docente' as tipo,
                    creado_en
                FROM Docentes
            `);

        const estudiantesResult = await pool.request()
            .query(`
                SELECT 
                    id_estudiante as id,
                    nombre,
                    apellido,
                    correo,
                    facultad,
                    id_carrera,
                    id_materia,
                    'estudiante' as tipo,
                    creado_en
                FROM Estudiantes
            `);

        const usuarios = [
            ...docentesResult.recordset.map(d => ({
                ...d,
                creado_en: new Date(d.creado_en).toISOString()
            })),
            ...estudiantesResult.recordset.map(e => ({
                ...e,
                creado_en: new Date(e.creado_en).toISOString()
            }))
        ];

        res.status(200).json({
            success: true,
            count: usuarios.length,
            data: usuarios
        });

    } catch (error) {
        console.error('Error en getAllUsers:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener usuarios',
            error: error.message
        });
    }
};

