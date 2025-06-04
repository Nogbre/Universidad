/* ──────────────────────────────────────────────────────────────────────
 *  src/utils/excelAdquisicion.js
 *  Genera la planilla “Solicitud de Adquisición de Activos”
 * ────────────────────────────────────────────────────────────────────── */

import path               from 'path';
import { fileURLToPath }  from 'url';
import ExcelJS            from 'exceljs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE   = path.join(__dirname, '../templates/solicitud.xlsx');

/* ───────────────────────── Helpers ───────────────────────── */

/** ① Normaliza texto p/ comparaciones */
const norm = (txt) =>
    (txt ?? '')
        .toString()
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036F]/g, '')
        .trim();

/** ② Sustituye {{TAG}} dentro de la misma celda */
function put(cell, tag, value = '') {
    if (typeof cell.value !== 'string') return;
    const re = new RegExp(`{{\\s*${tag}\\s*}}`, 'gi');
    if (re.test(cell.value)) cell.value = cell.value.replace(re, value);
}

/** ③ Escribe `value` en la primera celda a la derecha de la etiqueta */
function putNext(ws, cell, value) {
    let nextCol = cell.col + 1;           // supuesto por defecto (no fusionado)

    /* ExcelJS expone las fusiones en worksheet._merges (Map<ref, {tl,br}>) */
    if (cell.isMerged && ws._merges) {
        for (const merge of ws._merges.values()) {
            const { tl, br } = merge;         // top-left & bottom-right
            if (
                cell.row >= tl.row &&
                cell.row <= br.row &&
                cell.col >= tl.col &&
                cell.col <= br.col
            ) {
                nextCol = br.col + 1;           // una columna después del bloque
                break;
            }
        }
    }

    ws.getCell(cell.row, nextCol).value = value;
}

/* -------------------------------------------------------------------------
 * Localiza la fila de cabeceras (CANTIDAD | UNIDAD | DESCRIPCIÓN | …)
 * -------------------------------------------------------------------------*/
function locateTable(ws) {
    const headerKeys = {
        cantidad   : ['CANTIDAD', 'CANT'],
        unidad     : ['UNIDAD', 'UND'],
        descripcion: ['DESCRIPCION', 'DESCRIPCIÓN', 'DESC'],
        precio     : ['P/U', 'PU', 'PRECIO UNITARIO'],
        total      : ['TOTAL', 'VALOR TOTAL'],
    };

    for (const row of ws._rows.filter(Boolean)) {
        const map = {};
        row.eachCell((cell, col) => {
            const txt = norm(cell.value);
            if (!txt) return;                 // ④ ignora vacíos
            Object.entries(headerKeys).forEach(([k, opts]) => {
                if (opts.some((o) => txt === o)) map[k] = col;
            });
        });
        if (Object.keys(headerKeys).every((k) => map[k] !== undefined)) {
            let startRow = row.number + 1;
            while (
                ws.getRow(startRow).values.some(
                    (v, i) => i !== 0 && v !== null && v !== undefined && v !== ''
                )
                ) {
                startRow += 1;
            }
            return { startRow, cols: map };
        }
    }
    throw new Error(
        'No se encontró la fila de cabeceras de la tabla de ítems (CANTIDAD | UNIDAD | …)'
    );
}

/* ───────────────────────── Constructor ───────────────────────── */
export async function buildExcelAdquisicion({ cabecera: h, items }) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(TEMPLATE);
    const ws = wb.getWorksheet(1);

    /* 1. Marcadores {{TAG}} --------------------------------------------- */
    ws.eachRow((row) =>
        row.eachCell((cell) => {
            put(cell, 'UNIDAD_SOLICITANTE', h.unidadSolicitante);
            put(cell, 'RESPONSABLE', h.responsable);
            put(cell, 'CENTRO_COSTO', h.centroCosto);
            put(cell, 'CODIGO_INVERSION', h.codigoInversion);
            put(cell, 'FECHA_DIA', String(h.fechaEmision.dia).padStart(2, '0'));
            put(cell, 'FECHA_MES', String(h.fechaEmision.mes).padStart(2, '0'));
            put(cell, 'FECHA_ANIO', h.fechaEmision.anio);
            put(cell, 'JUSTIFICACION', h.justificacion);
            put(cell, 'OBSERVACIONES', h.observaciones);
            put(
                cell,
                'MONTO_TOTAL',
                h.montoTotal.toLocaleString('es-BO', { minimumFractionDigits: 2 })
            );
            put(cell, 'MONTO_LETRAS', h.montoLetras);
        })
    );

    /* 2. Etiquetas visibles --------------------------------------------- */
    const labelMap = {
        'UNIDAD SOLICITANTE': h.unidadSolicitante,
        'CENTRO DE COSTO': h.centroCosto,
        RESPONSABLE: h.responsable,
        'NRO. CODIGO DE INVERSION': h.codigoInversion,
    };

    ws.eachRow((row) =>
        row.eachCell((cell) => {
            const txt = norm(cell.value);
            Object.entries(labelMap).forEach(([lbl, val]) => {
                if (txt.startsWith(lbl) && val) putNext(ws, cell, val);
            });
            if (txt.startsWith('FECHA EMISION DEL PEDIDO')) {
                ws.getCell(cell.row, cell.col + 1).value = h.fechaEmision.dia;
                ws.getCell(cell.row, cell.col + 2).value = h.fechaEmision.mes;
                ws.getCell(cell.row, cell.col + 4).value = h.fechaEmision.anio; // salta “/”
            }
        })
    );

    /* 3. Ítems ----------------------------------------------------------- */
    const { startRow, cols } = locateTable(ws);
    let r = startRow;
    items.forEach((it) => {
        const row = ws.getRow(r++);
        row.getCell(cols.cantidad).value = it.cantidad;
        row.getCell(cols.unidad).value = it.unidad;
        row.getCell(cols.descripcion).value = it.descripcion;
        row.getCell(cols.precio).value = it.precioUnitario;
        row.getCell(cols.total).value = it.totalItem;
        row.commit();                       // ⑤ guarda en memoria
    });

    return wb;
}
