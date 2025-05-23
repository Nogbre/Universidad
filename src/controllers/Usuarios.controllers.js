import { getConnection } from '../database/connection.js';
import sql from 'mssql';

export const getAllUsers = async (req, res) => {
    try {
        const pool = await getConnection();
        const {
            tipo,
            nombre,
            apellido,
            correo,
            id_carrera,
            facultad,
            id_materia,
            page = 1,
            limit = 10
        } = req.query;

        const offset = (page - 1) * limit;

        let whereClauseDocentes = '';
        let whereClauseEstudiantes = '';
        const params = [];

        if (tipo === 'docentes' || !tipo) {
            const docenteFilters = [];
            if (nombre) {
                docenteFilters.push(`nombre LIKE '%' + @nombre + '%'`);
                params.push({ name: 'nombre', type: sql.VarChar(100), value: nombre });
            }
            if (apellido) {
                docenteFilters.push(`apellido LIKE '%' + @apellido + '%'`);
                params.push({ name: 'apellido', type: sql.VarChar(100), value: apellido });
            }
            if (correo) {
                docenteFilters.push(`correo = @correo`);
                params.push({ name: 'correo', type: sql.VarChar(100), value: correo });
            }
            if (id_carrera) {
                docenteFilters.push(`id_carrera = @id_carrera`);
                params.push({ name: 'id_carrera', type: sql.Int, value: id_carrera });
            }
            whereClauseDocentes = docenteFilters.length ? `WHERE ${docenteFilters.join(' AND ')}` : '';
        }

        if (tipo === 'estudiantes' || !tipo) {
            const estudianteFilters = [];
            if (nombre) {
                estudianteFilters.push(`nombre LIKE '%' + @nombre + '%'`);
                if (!params.some(p => p.name === 'nombre')) {
                    params.push({ name: 'nombre', type: sql.VarChar(100), value: nombre });
                }
            }
            if (apellido) {
                estudianteFilters.push(`apellido LIKE '%' + @apellido + '%'`);
                if (!params.some(p => p.name === 'apellido')) {
                    params.push({ name: 'apellido', type: sql.VarChar(100), value: apellido });
                }
            }
            if (correo) {
                estudianteFilters.push(`correo = @correo`);
                if (!params.some(p => p.name === 'correo')) {
                    params.push({ name: 'correo', type: sql.VarChar(100), value: correo });
                }
            }
            if (facultad) {
                estudianteFilters.push(`facultad = @facultad`);
                params.push({ name: 'facultad', type: sql.VarChar(100), value: facultad });
            }
            if (id_carrera) {
                estudianteFilters.push(`id_carrera = @id_carrera`);
                if (!params.some(p => p.name === 'id_carrera')) {
                    params.push({ name: 'id_carrera', type: sql.Int, value: id_carrera });
                }
            }
            if (id_materia) {
                estudianteFilters.push(`id_materia = @id_materia`);
                params.push({ name: 'id_materia', type: sql.Int, value: id_materia });
            }
            whereClauseEstudiantes = estudianteFilters.length ? `WHERE ${estudianteFilters.join(' AND ')}` : '';
        }

        const docentesQuery = `
            SELECT 
                id_docente as id,
                nombre,
                apellido,
                correo,
                id_carrera,
                'docente' as tipo
            FROM Docentes
            ${whereClauseDocentes}
            ORDER BY id_docente
            OFFSET ${offset} ROWS
            FETCH NEXT ${limit} ROWS ONLY
        `;

        const estudiantesQuery = `
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
            ${whereClauseEstudiantes}
            ORDER BY id_estudiante
            OFFSET ${offset} ROWS
            FETCH NEXT ${limit} ROWS ONLY
        `;

        const request = pool.request();
        params.forEach(param => request.input(param.name, param.type, param.value));

        const [docentes, estudiantes] = await Promise.all([
            tipo !== 'estudiantes' ? request.query(docentesQuery) : { recordset: [] },
            tipo !== 'docentes' ? request.query(estudiantesQuery) : { recordset: [] }
        ]);

        res.status(200).json({
            success: true,
            docentes: docentes.recordset,
            estudiantes: estudiantes.recordset,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: docentes.recordset.length + estudiantes.recordset.length
            }
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