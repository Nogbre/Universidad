import sql from 'mssql';
import { getConnection } from '../database/connection.js';
import { buildExcel } from '../utils/excelSolicitud.js';

/**
 * GET /api/solicitudes-estudiantes/:id/excel
 * Devuelve la planilla L-4 (.xlsx) con los datos de la solicitud.
 */
export const generarExcelSolicitudEstudiante = async (req, res) => {
    try {
        const { id } = req.params;
        if (isNaN(id)) {
            return res.status(400).json({ message: 'ID inválido' });
        }

        const pool = await getConnection();

        const cabeceraRs = await pool.request()
            .input('id', sql.Int, id)
            .query(`
                SELECT
                    s.*,
                    e.nombre + ' ' + e.apellido                       AS alumno,
                    c.nombre                                          AS carrera,
                    m.nombre                                          AS materia,
                    d.docente                                         AS docente        
                FROM  SolicitudesEstudiantes s
                          JOIN Estudiantes e       ON e.id_estudiante = s.id_estudiante
                          JOIN Carreras   c        ON c.id_carrera    = s.id_carrera
                          JOIN Materias   m        ON m.id_materia    = s.id_materia
                    OUTER APPLY (            
                  SELECT TOP 1 nombre + ' ' + apellido AS docente
                  FROM   Docentes
                  WHERE  id_carrera = c.id_carrera
              ) d
                WHERE s.id_solicitud = @id;
            `);

        if (!cabeceraRs.recordset.length) {
            return res.status(404).json({ message: 'Solicitud no encontrada' });
        }
        const s = cabeceraRs.recordset[0];

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
                sede:         'Santa Cruz de la Sierra',
                facultad:     s.carrera,
                departamento: 'Tecnologia',
                asignatura:   s.materia,
                alumno:       s.alumno,
                grupo:        '',
                gestion:      new Date().getFullYear(),
                titulo:       'Prestamo Individual',
                practica:     '',
                fecha:        new Date(s.fecha_hora_inicio).toLocaleDateString(),
                docente:      s.docente ?? '________________',
                observaciones: s.observaciones ?? ''
            },
            insumos: detalleRs.recordset.map(r => ({
                nombre:    r.nombre,
                cantidad:  r.cantidad,
                categoria: 'OTROS'
            }))
        };

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
