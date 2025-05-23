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

export const getUsersByType = async (req, res) => {
    try {
        const { tipo } = req.params;
        const pool = await getConnection();

        if (tipo === 'docentes') {
            const result = await pool.request()
                .query(`
                    SELECT 
                        id_docente as id,
                        nombre,
                        apellido,
                        correo,
                        id_carrera,
                        'docente' as tipo
                    FROM Docentes
                `);
            return res.json({
                success: true,
                count: result.recordset.length,
                data: result.recordset
            });
        }

        if (tipo === 'estudiantes') {
            const result = await pool.request()
                .query(`
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
                `);
            return res.json({
                success: true,
                count: result.recordset.length,
                data: result.recordset
            });
        }

        res.status(400).json({
            success: false,
            message: 'Tipo de usuario no válido. Usar: docentes/estudiantes'
        });

    } catch (error) {
        console.error(`Error al obtener ${tipo}:`, error);
        res.status(500).json({
            success: false,
            message: `Error al obtener ${tipo}`,
            error: error.message
        });
    }
};

export const getUserById = async (req, res) => {
    try {
        const { tipo, id } = req.params;
        const pool = await getConnection();

        if (tipo === 'docentes') {
            const result = await pool.request()
                .input('id', sql.Int, id)
                .query(`
                    SELECT 
                        id_docente as id,
                        nombre,
                        apellido,
                        correo,
                        id_carrera,
                        'docente' as tipo
                    FROM Docentes
                    WHERE id_docente = @id
                `);

            if (result.recordset.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Docente no encontrado'
                });
            }

            return res.json({
                success: true,
                data: result.recordset[0]
            });
        }

        if (tipo === 'estudiantes') {
            const result = await pool.request()
                .input('id', sql.Int, id)
                .query(`
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
                    WHERE id_estudiante = @id
                `);

            if (result.recordset.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Estudiante no encontrado'
                });
            }

            return res.json({
                success: true,
                data: result.recordset[0]
            });
        }

        res.status(400).json({
            success: false,
            message: 'Tipo de usuario no válido. Usar: docentes/estudiantes'
        });

    } catch (error) {
        console.error(`Error al obtener usuario por ID (${tipo}):`, error);
        res.status(500).json({
            success: false,
            message: `Error al obtener ${tipo.slice(0, -1)}`,
            error: error.message
        });
    }
};

