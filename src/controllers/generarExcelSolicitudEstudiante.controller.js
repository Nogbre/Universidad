// src/controllers/solicitudesEst.controller.js
import sql from 'mssql';
import { getConnection } from '../database/connection.js';
import { buildExcel } from '../utils/excelSolicitud.js';

/**
 * GET /api/solicitudes-estudiantes/:id/excel
 * Devuelve la planilla L-4 (.xlsx) ya rellenada.
 */
export const generarExcelSolicitudEstudiante = async (req, res) => {
    try {
        const { id } = req.params;
        if (isNaN(id)) {
            return res.status(400).json({ message: 'ID inválido' });
        }

        const pool = await getConnection();

        /* ────────────────── 1. Cabecera básica (alumno, carrera, materia) ────────────────── */
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

        const s = solicitudRs.recordset[0];

        /* ────────────────── 2. Detalle de insumos ────────────────── */
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

        /* ────────────────── 3. Construir payload para la plantilla ────────────────── */
        const data = {
            encabezado: {
                sede:          '__________',              // (rellenarán a mano)
                facultad:      s.carrera ?? '',
                departamento:  '__________',              // (rellenarán a mano)
                asignatura:    s.materia,
                grupo:         '__________',
                gestion:       new Date().getFullYear(),  // ej. 2025
                titulo:        '__________',
                practica:      '___',
                fecha:         new Date(s.fecha_hora_inicio).toLocaleDateString(),
                docente:       '________________',
                observaciones: s.observaciones ?? ''
            },
            /*
              Si tu tabla Insumos tiene una columna "categoria", inclúyela aquí
              para que el utilitario coloque cada ítem en la sección correcta.
            */
            insumos: detalleRs.recordset.map(r => ({
                nombre:   r.nombre,
                cantidad: r.cantidad,
                categoria: 'OTROS'           // ← o r.categoria si existe
            }))
        };

        /* ────────────────── 4. Generar y enviar Excel ────────────────── */
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
