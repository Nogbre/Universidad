// src/utils/excelAdquisicion.js
import path              from 'path';
import { fileURLToPath } from 'url';
import ExcelJS           from 'exceljs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE   = path.join(__dirname, '../templates/solicitud.xlsx');

/* ─────────── Helpers ─────────── */
function replace(cell, tag, value) {
    if (typeof cell.value === 'string' && cell.value.includes(tag)) {
        cell.value = cell.value.replace(tag, value);
    }
}

/* 1º intenta {{ITEMS_START}}  • Si no existe busca la fila de encabezados */
function locateTableStart(ws) {

    // (a) marcador explícito
    for (const row of ws._rows) {
        if (!row) continue;
        for (const cell of row._cells) {
            if (cell && cell.value === '{{ITEMS_START}}') {
                const pos = { row: cell.row, col: cell.col };
                cell.value = '';   // limpiamos el marcador
                return pos;
            }
        }
    }

    // (b) encabezados "Cantidad | Unidad | Descripción | P/U | Total"
    const headers = ['CANTIDAD', 'UNIDAD', 'DESCRIPCIÓN', 'P/U', 'TOTAL'];
    for (const row of ws._rows.filter(Boolean)) {
        const vals = row.values
            .slice(1, 1 + headers.length)            // valores reales (ignora index 0)
            .map(v => String(v ?? '').toUpperCase().trim());
        if (headers.every((h, i) => vals[i] === h)) {
            return { row: row.number + 1, col: row.values.findIndex(v => v !== undefined) };
        }
    }

    throw new Error('No se encontró ni {{ITEMS_START}} ni la fila de encabezados');
}

/**
 * buildExcelAdquisicion({ cabecera, items })
 *  cabecera: {…},  items: [{ cantidad, unidad, descripcion, precioUnitario, totalItem }]
 */
export async function buildExcelAdquisicion({ cabecera: h, items }) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(TEMPLATE);
    const ws = wb.getWorksheet(1);   // primera hoja

    /* ───── 1. Reemplazo de marcadores simples ───── */
    ws.eachRow(row => {
        row.eachCell(cell => {
            replace(cell, '{{UNIDAD_SOLICITANTE}}', h.unidadSolicitante);
            replace(cell, '{{RESPONSABLE}}',        h.responsable);
            replace(cell, '{{CENTRO_COSTO}}',       h.centroCosto);
            replace(cell, '{{CODIGO_INVERSION}}',   h.codigoInversion);
            replace(cell, '{{FECHA_DIA}}',          String(h.fechaEmision.dia).padStart(2,'0'));
            replace(cell, '{{FECHA_MES}}',          String(h.fechaEmision.mes).padStart(2,'0'));
            replace(cell, '{{FECHA_ANIO}}',         h.fechaEmision.anio);
            replace(cell, '{{JUSTIFICACION}}',      h.justificacion);
            replace(cell, '{{OBSERVACIONES}}',      h.observaciones);
            replace(cell, '{{MONTO_TOTAL}}',        h.montoTotal.toLocaleString('es-BO',{minimumFractionDigits:2}));
            replace(cell, '{{MONTO_LETRAS}}',       h.montoLetras);
        });
    });

    /* ───── 2. Ubicar tabla y volcar ítems ───── */
    const start = locateTableStart(ws);     // { row, col }
    let r = start.row;

    items.forEach(it => {
        const row = ws.getRow(r++);
        row.getCell(start.col    ).value = it.cantidad;
        row.getCell(start.col + 1).value = it.unidad;
        row.getCell(start.col + 2).value = it.descripcion;
        row.getCell(start.col + 3).value = it.precioUnitario;
        row.getCell(start.col + 4).value = it.totalItem;
        row.commit();
    });

    return wb;
}
