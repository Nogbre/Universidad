import sql               from 'mssql';
import { getConnection } from '../database/connection.js';
import { buildExcelAdquisicion } from '../utils/excelAdquisicion.js';

/* GET /solicitudes-adquisicion/:id/excel */
export const generarExcelSolicitudAdquisicion = async (req, res) => {
    try {
        const { id } = req.params;
        if (isNaN(id)) return res.status(400).json({ message: 'ID inválido' });

        const pool = await getConnection();

        /* ── Cabecera de la solicitud ───────────────────────────────────── */
        const cab = await pool.request()
            .input('id', sql.Int, id)
            .query(`
        SELECT sa.*,
               el.nombre + ' ' + el.apellido AS encargado,
               el.unidad_solicitante         AS unidad
        FROM   SolicitudesAdquisicion sa
           JOIN EncargadoLaboratorio el ON el.id_encargado = sa.id_encargado
        WHERE  sa.id_solicitud = @id;
      `);

        if (!cab.recordset.length)
            return res.status(404).json({ message: 'Solicitud no encontrada' });

        const s = cab.recordset[0];

        /* ── Detalle de ítems ───────────────────────────────────────────── */
        const det = await pool.request()
            .input('id', sql.Int, id)
            .query(`
        SELECT dsa.cantidad,
               dsa.unidad,
               dsa.descripcion,
               dsa.precio_unitario,
               dsa.total_item
        FROM   DetalleSolicitudAdquisicion dsa
        WHERE  dsa.id_solicitud = @id
        ORDER  BY dsa.id_detalle;
      `);

        /* ── Construcción de la estructura para Excel ───────────────────── */
        const data = {
            cabecera : {
                unidadSolicitante : s.unidad,
                responsable       : s.responsable,
                fechaEmision      : {
                    dia  : new Date(s.fecha_emision).getDate(),
                    mes  : new Date(s.fecha_emision).getMonth() + 1,
                    anio : new Date(s.fecha_emision).getFullYear()
                },
                centroCosto    : s.centro_costo     ?? '',
                codigoInversion: s.codigo_inversion ?? '',
                justificacion  : s.justificacion,
                observaciones  : s.observaciones    ?? '',
                montoTotal     : Number(s.monto_total),
                montoLetras    : s.monto_letras
            },
            items : det.recordset.map(r => ({
                cantidad       : r.cantidad,
                unidad         : r.unidad,
                descripcion    : r.descripcion,
                precioUnitario : Number(r.precio_unitario),
                totalItem      : Number(r.total_item)
            }))
        };

        /* ── Crear y enviar el Excel ─────────────────────────────────────── */
        const wb = await buildExcelAdquisicion(data);

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=Solicitud_Adquisicion_${id}_${s.fecha_emision}.xlsx`
        );

        await wb.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error('Error generando Excel:', err);
        res.status(500).json({ message: 'Error interno al generar Excel' });
    }
};
