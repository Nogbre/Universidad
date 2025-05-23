import { getConnection } from '../database/connection.js';
import sql from 'mssql';
import jwt from 'jsonwebtoken';

const saltRounds = 10;

export const getAllUsers = async (req, res) => {
    try {
        const pool = await getConnection();

        const [docentes, estudiantes] = await Promise.all([
            pool.request().query(`
                SELECT 
                    id_docente as id,
                    nombre,
                    apellido,
                    correo,
                    id_carrera,
                    'docente' as tipo
                FROM Docentes
            `),
            pool.request().query(`
                SELECT 
                    id_estudiante as id,
                    nombre,
                    apellido,
                    correo,
                    facultad,
                    id_carrera,
                    id_materia,
                    'estudiante' as tipo
                FROM Estudiantes
            `)
        ]);

        const result = {
            docentes: docentes.recordset,
            estudiantes: estudiantes.recordset,
            total: docentes.recordset.length + estudiantes.recordset.length
        };

        res.status(200).json(result);

    } catch (error) {
        console.error('Error en getAllUsers:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener usuarios',
            error: error.message
        });
    }
};

