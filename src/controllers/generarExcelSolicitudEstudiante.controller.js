// src/controllers/solicitudesEst.controller.js
import sql from 'mssql';
import { getConnection } from '../database/connection.js';
import { buildExcel } from '../utils/excelSolicitud.js';


export const generarExcelSolicitudEstudiante = async (req, res) => {
    try {
        const { id } = req.params;
        if (isNaN(id)) {
            return res.status(400).json({ message: 'ID inválido' });
        }

        const pool = await getConnection();

        /* 1. Cabecera de la solicitud */
        const solicitud = await pool.request()
            .input('id', sql.Int, id)
            .query(`
        SELECT s.*, 
               e.nombre + ' ' + e.apellido             AS alumno,
               c.nombre                                AS carrera,
               m.nombre                                AS materia,
               d.nombre + ' ' + d.apellido             AS docente
        FROM   SolicitudesEstudiantes s
        JOIN   Estudiantes  e ON e.id_estudiante   = s.id_estudiante
        JOIN   Carreras     c ON c.id_carrera      = s.id_carrera
        JOIN   Materias     m ON m.id_materia      = s.id_materia
        JOIN   Docentes     d ON d.id_docente      = m.id_docente
        WHERE  s.id_solicitud = @id
      `);

        if (!solicitud.recordset.length) {
            return res.status(404).json({ message: 'Solicitud no encontrada' });
        }

        /* 2. Detalle de insumos */
        const detalle = await pool.request()
            .input('id', sql.Int, id)
            .query(`
        SELECT i.nombre,
               d.cantidad_solicitada AS cantidad
        FROM   DetalleSolicitudEstudiante d
        JOIN   Insumos i ON i.id_insumo = d.id_insumo
        WHERE  d.id_solicitud = @id
      `);

        /* 3. Ensambla payload */
        const data = {
            encabezado: {
                fecha:      new Date(solicitud.recordset[0].fecha_hora_inicio).toLocaleDateString(),
                alumno:     solicitud.recordset[0].alumno,
                carrera:    solicitud.recordset[0].carrera,
                materia:    solicitud.recordset[0].materia,
                docente:    solicitud.recordset[0].docente,
                observaciones: solicitud.recordset[0].observaciones
            },
            insumos: detalle.recordset
        };

        const workbook = await buildExcel(data);

        res.setHeader('Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=solicitud-${id}.xlsx`
        );

        await workbook.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error('Error generando Excel:', err);
        res.status(500).json({ message: 'Error interno al generar Excel' });
    }
};
