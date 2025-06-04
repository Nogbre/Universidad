/* ──────────────────────────────────────────────────────────────────────
 *  src/utils/excelAdquisicion.js
 *  Genera la planilla “Solicitud de Adquisición de Activos”
 *  (secciones ①-⑤ numeradas para mantenimiento)
 * ────────────────────────────────────────────────────────────────────── */

import path              from 'path';
import { fileURLToPath } from 'url';
import ExcelJS           from 'exceljs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE  = path.join(__dirname, '../templates/solicitud.xlsx');

/* ───────────────────────── Helpers ───────────────────────── */

/** ① Normaliza texto para comparaciones */
const norm = (txt) =>
    (txt ?? '')
        .toString()
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036F]/g, '')
        .trim();

/** ② Sustituye {{TAG}} dentro de la misma celda */
function put(cell, tag, value = '') {
    if (typeof cell.value !== 'string') return false;
    const re = new RegExp(`{{\\s*${tag}\\s*}}`, 'gi');
    const matched = re.test(cell.value);
    if (matched) cell.value = cell.value.replace(re, value);
    return matched;                             // indica si realmente lo reemplazó
}

/* Convierte "AB12" → { row:12, col:28 } (para fusiones) */
function decodeAddr(addr) {
    const m = typeof addr === 'string' && addr.match(/^([A-Z]+)(\d+)$/);
    if (!m) return { row: 0, col: 0 };
    const [, letters, digits] = m;
    let col = 0;
    for (const ch of letters) col = col * 26 + (ch.charCodeAt(0) - 64);
    return { row: Number(digits), col };
}

/** Devuelve la primera columna vacía a la derecha de `cell` (respeta fusiones) */
function firstBlankRight(ws, cell) {
    let c = cell.col + 1;

    // si el rótulo está fusionado, saltar todo el bloque
    if (cell.isMerged && ws._merges) {
        const refs = ws._merges instanceof Map ? [...ws._merges.keys()]
            : Object.keys(ws._merges);
        for (const ref of refs.filter(r => typeof r === 'string' && r.includes(':'))) {
            const [tl, br]            = ref.split(':');
            const { row: r1, col: c1 } = decodeAddr(tl);
            const { row: r2, col: c2 } = decodeAddr(br);
            if (cell.row >= r1 && cell.row <= r2 && cell.col >= c1 && cell.col <= c2) {
                c = c2 + 1;
                break;
            }
        }
    }

    // avanzar mientras la celda no esté realmente vacía
    while (
        ws.getCell(cell.row, c).value !== null &&
        ws.getCell(cell.row, c).value !== undefined &&
        ws.getCell(cell.row, c).value !== ''
        ) {
        c += 1;
    }
    return c;
}

/* -------------------------------------------------------------------------
 * Localiza fila de cabeceras (CANTIDAD | UNIDAD | DESCRIPCIÓN | …)
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
            if (!txt) return;                            /* ④ ignora vacíos */
            Object.entries(headerKeys).forEach(([k, opts]) => {
                if (opts.some(o => txt === o)) map[k] = col;
            });
        });

        if (Object.keys(headerKeys).every(k => map[k] !== undefined)) {
            let startRow = row.number + 1;
            while (
                ws.getRow(startRow).values.some(
                    (v, i) => i !== 0 && v !== null && v !== undefined && v !== ''
                )
                ) startRow += 1;
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

    /* 1. Marcadores {{TAG}} ------------------------------------------------ */
    ws.eachRow(row =>
        row.eachCell(cell => {
            // grandes bloques de texto
            put(cell, 'JUSTIFICACION',  h.justificacion);
            put(cell, 'OBSERVACIONES',  h.observaciones);

            // fecha y montos
            put(cell, 'FECHA_DIA',      String(h.fechaEmision.dia).padStart(2, '0'));
            put(cell, 'FECHA_MES',      String(h.fechaEmision.mes).padStart(2, '0'));
            put(cell, 'FECHA_ANIO',     h.fechaEmision.anio);
            put(cell, 'MONTO_TOTAL',
                h.montoTotal.toLocaleString('es-BO', { minimumFractionDigits: 2 }));
            put(cell, 'MONTO_LETRAS',   h.montoLetras);

            // cabecera: solo si la plantilla efectivamente trae el marcador
            put(cell, 'UNIDAD_SOLICITANTE', h.unidadSolicitante);
            put(cell, 'CENTRO_COSTO',       h.centroCosto);
            put(cell, 'RESPONSABLE',        h.responsable);
            put(cell, 'CODIGO_INVERSION',   h.codigoInversion);
        })
    );

    /* 2. Etiquetas visibles (fallback cuando NO hay marcador) -------------- */
    const labelMap = {
        'UNIDAD SOLICITANTE'       : h.unidadSolicitante,
        'CENTRO DE COSTO'          : h.centroCosto,
        RESPONSABLE                : h.responsable,
        'NRO. CODIGO DE INVERSION' : h.codigoInversion,
    };

    ws.eachRow(row =>
        row.eachCell(cell => {
            const txt = norm(cell.value);
            Object.entries(labelMap).forEach(([lbl, val]) => {
                if (txt === lbl && val) {                         // ⇠ coincide EXACTO
                    const colDest = firstBlankRight(ws, cell);
                    ws.getCell(cell.row, colDest).value = val;
                }
            });

            // fecha (solo si no existían marcadores de fecha)
            if (txt === 'FECHA EMISION DEL PEDIDO') {
                ws.getCell(cell.row, cell.col + 1).value = h.fechaEmision.dia;
                ws.getCell(cell.row, cell.col + 2).value = h.fechaEmision.mes;
                ws.getCell(cell.row, cell.col + 4).value = h.fechaEmision.anio; // salta “/”
            }
        })
    );

    /* 3. Ítems -------------------------------------------------------------- */
    const { startRow, cols } = locateTable(ws);
    let r = startRow;
    items.forEach(it => {
        const row = ws.getRow(r++);
        row.getCell(cols.cantidad   ).value = it.cantidad;
        row.getCell(cols.unidad     ).value = it.unidad;
        row.getCell(cols.descripcion).value = it.descripcion;
        row.getCell(cols.precio     ).value = it.precioUnitario;
        row.getCell(cols.total      ).value = it.totalItem;
        row.commit();                              /* ⑤ guarda en memoria */
    });

    return wb;
}
