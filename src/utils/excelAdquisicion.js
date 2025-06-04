/* ──────────────────────────────────────────────────────────────────────
 *  src/utils/excelAdquisicion.js
 *  Construye la planilla de Solicitud de Adquisición usando ExcelJS
 * ────────────────────────────────────────────────────────────────────── */

import path              from 'path';
import { fileURLToPath } from 'url';
import ExcelJS           from 'exceljs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE   = path.join(__dirname, '../templates/solicitud.xlsx');

/* ───────────────────────── Helpers ───────────────────────── */

const norm = (txt) =>
    (txt ?? '')
        .toString()
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

function put(cell, tag, value = '') {
    if (typeof cell.value !== 'string') return;
    const re = new RegExp(`{{\\s*${tag}\\s*}}`, 'gi');
    if (re.test(cell.value)) cell.value = cell.value.replace(re, value);
}

/* ───────────────────── Localizar tabla de ítems ───────────────────── */

function locateTable(ws) {
    const headerKeys = {
        cantidad   : ['CANTIDAD', 'CANT'],
        unidad     : ['UNIDAD', 'UND'],
        descripcion: ['DESCRIPCION', 'DESCRIPCIÓN', 'DESC'],
        precio     : ['P/U', 'PU', 'PRECIO UNITARIO'],
        total      : ['TOTAL', 'VALOR TOTAL']
    };

    for (const row of ws._rows.filter(Boolean)) {
        const map = {};
        row.eachCell((cell, colNumber) => {
            const txt = norm(cell.value);
            if (!txt) return;
            Object.entries(headerKeys).forEach(([key, list]) => {
                if (list.some(h => h === txt)) map[key] = colNumber;
            });
        });

        if (Object.keys(headerKeys).every(k => map[k] !== undefined)) {
            let startRow = row.number + 1;
            while (
                ws.getRow(startRow).values.some(
                    (v, i) => i !== 0 && v !== null && v !== undefined && v !== ''
                )
                ) startRow++;
            return { startRow, cols: map };
        }
    }
    throw new Error(
        'No se encontró la fila de cabeceras (CANTIDAD | UNIDAD | …) en la plantilla.'
    );
}

/* ───────────────────── Constructor principal ───────────────────── */

export async function buildExcelAdquisicion({ cabecera: h, items }) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(TEMPLATE);
    const ws = wb.getWorksheet(1);

    /* 1. Marcadores simples -------------------------------------------------- */
    ws.eachRow(row =>
        row.eachCell(cell => {
            put(cell, 'UNIDAD_SOLICITANTE', h.unidadSolicitante);
            put(cell, 'RESPONSABLE',        h.responsable);
            put(cell, 'ENCARGADO',          h.encargado);        // ← nuevo
            put(cell, 'CENTRO_COSTO',       h.centroCosto);
            put(cell, 'CODIGO_INVERSION',   h.codigoInversion);
            put(cell, 'FECHA_DIA',          String(h.fechaEmision.dia).padStart(2,'0'));
            put(cell, 'FECHA_MES',          String(h.fechaEmision.mes).padStart(2,'0'));
            put(cell, 'FECHA_ANIO',         h.fechaEmision.anio);
            put(cell, 'FECHA_COMPLETA',     h.fechaCompleta);    // ← nuevo
            put(cell, 'JUSTIFICACION',      h.justificacion);
            put(cell, 'OBSERVACIONES',      h.observaciones);
            put(cell, 'MONTO_TOTAL',
                h.montoTotal.toLocaleString('es-BO', { minimumFractionDigits: 2 }));
            put(cell, 'MONTO_LETRAS',       h.montoLetras);
            put(cell, 'MONTO_LETRAS_OBLIG', h.montoLetras);      // ← nuevo
        })
    );

    /* 2. Tabla dinámica de ítems -------------------------------------------- */
    const { startRow, cols } = locateTable(ws);
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
