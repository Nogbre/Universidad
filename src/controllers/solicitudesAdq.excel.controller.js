/***********************************************************************
 *  Descarga Excel para una Solicitud de Adquisición
 *  GET /solicitudes-adquisicion/:id/excel
 ***********************************************************************/

import sql               from 'mssql';
import { getConnection } from '../database/connection.js';
import { buildExcelAdquisicion } from '../utils/excelAdquisicion.js';

export const generarExcelSolicitudAdquisicion = async (req, res) => {
    try {
        const { id } = req.params;
        if (isNaN(id)) {
            return res.status(400).json({ message: 'ID inválido' });
        }

        /* ──────────────── 1. CABECERA ──────────────── */
        const pool   = await getConnection();
        const cabRS  = await pool.request()
            .input('id', sql.Int, id)
            .query(`
                SELECT sa.*,
                       el.nombre + ' ' + el.apellido AS encargado,
                       el.unidad_solicitante         AS unidad
                FROM   SolicitudesAdquisicion sa
                           JOIN EncargadoLaboratorio el ON el.id_encargado = sa.id_encargado
                WHERE  sa.id_solicitud = @id;
            `);

        if (!cabRS.recordset.length) {
            return res.status(404).json({ message: 'Solicitud no encontrada' });
        }

        const s   = cabRS.recordset[0];      // cabecera
        const hoy = new Date();              // fecha actual (hoja suele firmarse “hoy”)

        /* ──────────────── 2. DETALLE ──────────────── */
        const detRS = await pool.request()
            .input('id', sql.Int, id)
            .query(`
        SELECT cantidad,
               unidad,
               descripcion,
               precio_unitario,
               total_item
        FROM   DetalleSolicitudAdquisicion
        WHERE  id_solicitud = @id
        ORDER  BY id_detalle;
      `);

        /* ──────────────── 3. PAYLOAD para Excel ──────────────── */
        const payload = {
            cabecera: {
                unidadSolicitante : (s.unidad            ?? '').toUpperCase(),
                responsable       : (s.responsable       ?? s.encargado).toUpperCase(),
                encargado         : s.encargado,                // ← por si la plantilla lo quiere aparte
                fechaEmision      : {                           // HOY
                    dia  : hoy.getDate(),
                    mes  : hoy.getMonth() + 1,
                    anio : hoy.getFullYear()
                },
                fechaCompleta     : hoy.toLocaleDateString('es-BO'),
                centroCosto       : s.centro_costo     ?? '',
                codigoInversion   : s.codigo_inversion ?? '',
                justificacion     : s.justificacion,
                observaciones     : s.observaciones    ?? '',
                montoTotal        : Number(s.monto_total),
                montoLetras       : s.monto_letras
            },
            items: detRS.recordset.map(r => ({
                cantidad       : r.cantidad,
                unidad         : r.unidad,
                descripcion    : r.descripcion,
                precioUnitario : Number(r.precio_unitario),
                totalItem      : Number(r.total_item)
            }))
        };

        /* ──────────────── 4. CREAR Y ENVIAR ──────────────── */
        const wb = await buildExcelAdquisicion(payload);

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=Solicitud_Adquisicion_${id}_${hoy.toISOString().slice(0,10)}.xlsx`
        );

        await wb.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('Error generando Excel:', err);
        res.status(500).json({ message: 'Error interno al generar Excel' });
    }
};
