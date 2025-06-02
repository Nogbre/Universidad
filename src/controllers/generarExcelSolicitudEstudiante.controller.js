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

        const solicitudRs = await pool.request()
            .input('id', sql.Int, id)
            .query(`
                SELECT
                    s.*,
                    e.nombre + ' ' + e.apellido AS alumno,
                    c.nombre                    AS carrera,
                    m.nombre                    AS materia
                FROM  SolicitudesEstudiantes s
                          JOIN Estudiantes e ON e.id_estudiante = s.id_estudiante
                          JOIN Carreras   c ON c.id_carrera    = s.id_carrera
                          JOIN Materias   m ON m.id_materia    = s.id_materia
                WHERE s.id_solicitud = @id;
            `);

        if (!solicitudRs.recordset.length) {
            return res.status(404).json({ message: 'Solicitud no encontrada' });
        }

        const solicitud = solicitudRs.recordset[0];

        const detalleRs = await pool.request()
            .input('id', sql.Int, id)
            .query(`
        SELECT
          i.nombre,
          dse.cantidad_solicitada AS cantidad
        FROM  DetalleSolicitudEstudiante dse
              JOIN Insumos i ON i.id_insumo = dse.id_insumo
        WHERE dse.id_solicitud = @id;
      `);

        const data = {
            encabezado: {
                fecha:         new Date(solicitud.fecha_hora_inicio).toLocaleDateString(),
                alumno:        solicitud.alumno,
                carrera:       solicitud.carrera,
                materia:       solicitud.materia,
                docente:       '________________',
                observaciones: solicitud.observaciones ?? ''
            },
            insumos: detalleRs.recordset
        };

        /* 4. Generar y enviar Excel */
        const wb = await buildExcel(data);

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=solicitud-${id}.xlsx`
        );

        await wb.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error('Error generando Excel:', err);
        res.status(500).json({ message: 'Error interno al generar Excel' });
    }
};
