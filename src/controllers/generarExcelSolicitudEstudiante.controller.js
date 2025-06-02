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

        /* ───────────────────────── 1. Solicitud + Materia ───────────────────────── */
        const solicitudRs = await pool.request()
            .input('id', sql.Int, id)
            .query(`
                SELECT
                    s.*,
                    e.nombre + ' ' + e.apellido   AS alumno,
                    c.nombre                      AS carrera,
                    m.nombre                      AS materia,
                    m.id_docente                  AS id_docente   -- ← sólo el ID
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

        /* ───────────────────────── 2. Datos del Docente ─────────────────────────── */
        let docenteNombre = 'Sin registro';
        if (solicitud.id_docente !== null) {
            const docenteRs = await pool.request()
                .input('docId', sql.Int, solicitud.id_docente)
                .query(`
          SELECT nombre, apellido
          FROM   Docentes
          WHERE  id_docente = @docId;
        `);

            if (docenteRs.recordset.length) {
                const d = docenteRs.recordset[0];
                docenteNombre = `${d.nombre} ${d.apellido}`;
            }
        }

        /* ───────────────────────── 3. Detalle de insumos ────────────────────────── */
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

        /* ───────────────────────── 4. Payload para Excel ────────────────────────── */
        const data = {
            encabezado: {
                fecha:         new Date(solicitud.fecha_hora_inicio).toLocaleDateString(),
                alumno:        solicitud.alumno,
                carrera:       solicitud.carrera,
                materia:       solicitud.materia,
                docente:       docenteNombre,
                observaciones: solicitud.observaciones ?? ''
            },
            insumos: detalleRs.recordset          // [{ nombre, cantidad }, …]
        };

        /* ───────────────────────── 5. Genera y envía Excel ──────────────────────── */
        const workbook = await buildExcel(data);

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
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
