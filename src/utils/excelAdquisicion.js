// src/utils/excelAdquisicion.js
import path              from 'path';
import { fileURLToPath } from 'url';
import ExcelJS           from 'exceljs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE   = path.join(__dirname, '../templates/solicitud.xlsx');

/* ───────── helpers ───────── */
const sinAcentos = (t='') =>
    t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();

function replace(cell, tag, value='') {
    if (typeof cell.value === 'string' && cell.value.includes(tag)) {
        cell.value = cell.value.replace(tag, value);
    }
}

/* ───────── localizar inicio de tabla ───────── */
function locateTableStart(ws) {

    /* (a) marcador explícito */
    for (const row of ws._rows) {
        if (!row) continue;
        for (const cell of row._cells) {
            if (cell && cell.value === '{{ITEMS_START}}') {
                const pos = { row: cell.row, col: cell.col };
                cell.value = '';          // limpiar marcador
                return pos;
            }
        }
    }

    /* (b) fila-encabezado flexible */
    const need = ['CANTIDAD', 'UNIDAD', 'DESCRIPCION', 'P/U', 'TOTAL', 'VALOR TOTAL'];
    for (const row of ws._rows.filter(Boolean)) {
        const texts = row.values.map(v => sinAcentos(v ?? ''));
        const hits  = texts.filter(t => need.includes(t)).length;
        if (hits >= 3) {                           // al menos 3 coincidencias
            const qtyCol = texts.findIndex(t => t === 'CANTIDAD') || 1;
            return { row: row.number + 1, col: qtyCol };
        }
    }

    throw new Error('No se encontró {{ITEMS_START}} ni una fila de encabezados válida');
}

/* ───────── constructor de Excel ───────── */
export async function buildExcelAdquisicion({ cabecera: h, items }) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(TEMPLATE);
    const ws = wb.getWorksheet(1);

    /* 1. marcadores sencillos */
    ws.eachRow(r => r.eachCell(c => {
        replace(c, '{{UNIDAD_SOLICITANTE}}', h.unidadSolicitante);
        replace(c, '{{RESPONSABLE}}',        h.responsable);
        replace(c, '{{CENTRO_COSTO}}',       h.centroCosto);
        replace(c, '{{CODIGO_INVERSION}}',   h.codigoInversion);
        replace(c, '{{FECHA_DIA}}',          String(h.fechaEmision.dia).padStart(2,'0'));
        replace(c, '{{FECHA_MES}}',          String(h.fechaEmision.mes).padStart(2,'0'));
        replace(c, '{{FECHA_ANIO}}',         h.fechaEmision.anio);
        replace(c, '{{JUSTIFICACION}}',      h.justificacion);
        replace(c, '{{OBSERVACIONES}}',      h.observaciones);
        replace(c, '{{MONTO_TOTAL}}',        h.montoTotal.toLocaleString('es-BO',{minimumFractionDigits:2}));
        replace(c, '{{MONTO_LETRAS}}',       h.montoLetras);
    }));

    /* 2. tabla dinámica de ítems */
    const start = locateTableStart(ws);      // { row, col }
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
