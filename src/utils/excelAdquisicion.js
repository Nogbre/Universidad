import path               from 'path';
import { fileURLToPath }  from 'url';
import ExcelJS            from 'exceljs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE   = path.join(__dirname, '../templates/solicitud.xlsx');

/* Reemplaza la celda si contiene el marcador dado */
function replaceMarker(cell, tag, value) {
    if (typeof cell.value === 'string' && cell.value.includes(tag)) {
        cell.value = cell.value.replace(tag, value);
    }
}

/* Busca la celda que exactamente tiene el texto {{ITEMS_START}} */
function findItemsStart(ws) {
    for (const row of ws._rows) {
        if (!row) continue;
        for (const cell of row._cells) {
            if (cell && cell.value === '{{ITEMS_START}}') {
                return { row: cell.row, col: cell.col };
            }
        }
    }
    throw new Error('Marcador {{ITEMS_START}} no encontrado en la plantilla');
}

/**
 * buildExcelAdquisicion({ cabecera, items })
 * Devuelve un Workbook listo para descargar
 */
export async function buildExcelAdquisicion({ cabecera: h, items }) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(TEMPLATE);
    const ws = wb.getWorksheet(1);    // primera hoja

    /* ───────── 1. Reemplazo de marcadores simples ───────── */
    ws.eachRow(row => {
        row.eachCell(cell => {
            replaceMarker(cell, '{{UNIDAD_SOLICITANTE}}', h.unidadSolicitante);
            replaceMarker(cell, '{{RESPONSABLE}}',        h.responsable);
            replaceMarker(cell, '{{CENTRO_COSTO}}',       h.centroCosto);
            replaceMarker(cell, '{{CODIGO_INVERSION}}',   h.codigoInversion);
            replaceMarker(cell, '{{FECHA_DIA}}',          String(h.fechaEmision.dia).padStart(2,'0'));
            replaceMarker(cell, '{{FECHA_MES}}',          String(h.fechaEmision.mes).padStart(2,'0'));
            replaceMarker(cell, '{{FECHA_ANIO}}',         h.fechaEmision.anio);
            replaceMarker(cell, '{{JUSTIFICACION}}',      h.justificacion);
            replaceMarker(cell, '{{OBSERVACIONES}}',      h.observaciones);
            replaceMarker(cell, '{{MONTO_TOTAL}}',        h.montoTotal.toLocaleString('es-BO',{minimumFractionDigits:2}));
            replaceMarker(cell, '{{MONTO_LETRAS}}',       h.montoLetras);
        });
    });

    /* ───────── 2. Tabla dinámica de ítems ───────── */
    const start = findItemsStart(ws);            // coordenadas de arranque
    let r = start.row;                           // fila actual
    ws.getCell(start.row, start.col).value = ''; // limpia el marcador

    items.forEach(it => {
        const row = ws.getRow(r++);
        // Se asume estructura: Cantidad | Unidad | Descripción | P/U | Total
        row.getCell(start.col    ).value = it.cantidad;
        row.getCell(start.col + 1).value = it.unidad;
        row.getCell(start.col + 2).value = it.descripcion;
        row.getCell(start.col + 3).value = it.precioUnitario;
        row.getCell(start.col + 4).value = it.totalItem;
        row.commit();
    });

    return wb;
}
