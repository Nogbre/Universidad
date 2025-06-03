import path              from 'path';
import { fileURLToPath } from 'url';
import ExcelJS           from 'exceljs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE   = path.join(__dirname, '../templates/solicitud.xlsx');

/* ────────────────────────── Helpers ────────────────────────── */

/** Reemplaza `{{TAG}}` en una celda conservando el resto del texto */
function replace(cell, tag, value = '') {
    if (typeof cell.value === 'string' && cell.value.includes(tag)) {
        cell.value = cell.value.replace(tag, value);
    }
}

/**
 * Localiza la fila‐cabecera de la tabla de ítems.
 * Devuelve el nº de fila donde empiezan los datos **y** el mapa de columnas.
 *
 *  🌟  Tolera plantillas con columnas “de separación” (celdas vacías):
 *       A      B     C      D   …   N   O   P    Q
 *    ┌────┬────┬────┬────┬───┬───┬───┬───┬────┐
 *    │Cant│    │Uni │    │Desc … │P/U│   │Total│
 *
 *  Resultado: `{ row:  cabRow + 1,
 *                cols: { cantidad: 1, unidad: 3, descripcion: 5, precio: 14, total: 17 } }`
 */
function locateTable(ws) {
    const normalize = (v) => String(v ?? '')
        .toUpperCase()
        .replace('Ó', 'O')        // quita tildes para comparar
        .trim();

    for (const row of ws._rows.filter(Boolean)) {
        for (const cell of row._cells.filter(Boolean)) {
            const val = normalize(cell.value);
            if (val === 'CANTIDAD') {
                // Recorremos la misma fila buscando las demás cabeceras
                const headers = {
                    cantidad   : 'CANTIDAD',
                    unidad     : 'UNIDAD',
                    descripcion: 'DESCRIPCION',   // sin tilde
                    precio     : 'P/U',
                    total      : 'VALOR TOTAL'
                };

                const cols = { };
                row._cells.forEach(c => {
                    const x = normalize(c.value);
                    const key = Object.keys(headers).find(k => headers[k] === x);
                    if (key) cols[key] = c.col;
                });

                // Si encontramos TODAS las cabeceras devolvemos el punto de inserción
                if (Object.keys(headers).every(k => cols[k] !== undefined)) {
                    return { row: row.number + 1, cols };
                }
            }
        }
    }
    throw new Error('No se encontró la fila de cabeceras de la tabla de ítems');
}

/* ────────────────────────── Builder ────────────────────────── */

/**
 * buildExcelAdquisicion({ cabecera, items })
 *
 *   cabecera → {
 *     unidadSolicitante, responsable, centroCosto, codigoInversion,
 *     fechaEmision:{dia,mes,anio}, justificacion, observaciones,
 *     montoTotal,   montoLetras
 *   }
 *
 *   items → [{ cantidad, unidad, descripcion, precioUnitario, totalItem }]
 */
export async function buildExcelAdquisicion({ cabecera: h, items }) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(TEMPLATE);
    const ws = wb.getWorksheet(1);

    /* ─── 1. Reemplazo de marcadores simples ─── */
    ws.eachRow(row => row.eachCell(cell => {
        replace(cell, '{{UNIDAD_SOLICITANTE}}', h.unidadSolicitante);
        replace(cell, '{{RESPONSABLE}}',        h.responsable);
        replace(cell, '{{CENTRO_COSTO}}',       h.centroCosto);
        replace(cell, '{{CODIGO_INVERSION}}',   h.codigoInversion);
        replace(cell, '{{FECHA_DIA}}',          String(h.fechaEmision.dia).padStart(2, '0'));
        replace(cell, '{{FECHA_MES}}',          String(h.fechaEmision.mes).padStart(2, '0'));
        replace(cell, '{{FECHA_ANIO}}',         h.fechaEmision.anio);
        replace(cell, '{{JUSTIFICACION}}',      h.justificacion);
        replace(cell, '{{OBSERVACIONES}}',      h.observaciones);
        replace(cell, '{{MONTO_TOTAL}}',        h.montoTotal.toLocaleString('es-BO', { minimumFractionDigits: 2 }));
        replace(cell, '{{MONTO_LETRAS}}',       h.montoLetras);
    }));

    /* ─── 2. Tabla de ítems ─── */
    const { row: startRow, cols } = locateTable(ws);
    let r = startRow;

    items.forEach(it => {
        const row = ws.getRow(r++);
        row.getCell(cols.cantidad   ).value = it.cantidad;
        row.getCell(cols.unidad     ).value = it.unidad;
        row.getCell(cols.descripcion).value = it.descripcion;
        row.getCell(cols.precio     ).value = it.precioUnitario;
        row.getCell(cols.total      ).value = it.totalItem;
        row.commit();
    });

    return wb;
}
