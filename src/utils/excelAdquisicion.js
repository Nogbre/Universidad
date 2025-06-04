/* ──────────────────────────────────────────────────────────────────────
 *  src/utils/excelAdquisicion.js
 *  Genera la planilla “Solicitud de Adquisición de Activos” a partir de
 *  la plantilla /templates/solicitud.xlsx
 * ────────────────────────────────────────────────────────────────────── */

import path               from 'path';
import { fileURLToPath }  from 'url';
import ExcelJS            from 'exceljs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE   = path.join(__dirname, '../templates/solicitud.xlsx');

/* ───────────────────────── Helpers ───────────────────────── */

/** ① Normaliza texto: mayúsculas, sin tildes, sin espacios extras */
const norm = (txt) =>
    (txt ?? '')
        .toString()
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036F]/g, '')
        .trim();

/** ② Reemplaza un marcador {{TAG}} dentro de la misma celda */
function put(cell, tag, value = '') {
    if (typeof cell.value !== 'string') return;
    const re = new RegExp(`{{\\s*${tag}\\s*}}`, 'gi');
    if (re.test(cell.value)) cell.value = cell.value.replace(re, value);
}

/** ③ Coloca un valor a la derecha de la celda-etiqueta (maneja rangos fusionados) */
function putNext(ws, cell, value) {
    // si la etiqueta está fusionada (A8:C8), usamos la siguiente columna del rango
    let { col, row } = cell;
    for (const rng of ws.mergedCells) {
        if (rng.contains(cell.address)) {
            col = rng.master.col + (rng.width - 0) /* primera col libre a la derecha */;
            break;
        }
    }
    ws.getCell(row, col + 1).value = value;
}

/* -------------------------------------------------------------------------
 * Localiza la fila de cabeceras (CANTIDAD | UNIDAD | DESCRIPCIÓN | P/U | …)
 * Devuelve: { startRow, cols:{ cantidad, unidad, descripcion, precio, total } }
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

        row.eachCell((cell, colNumber) => {
            const txt = norm(cell.value);
            if (!txt) return;                               // ④ ignora vacíos

            Object.entries(headerKeys).forEach(([key, options]) => {
                if (options.some((o) => txt === o)) map[key] = colNumber;
            });
        });

        if (Object.keys(headerKeys).every((k) => map[k] !== undefined)) {
            // primera fila 100 % vacía debajo de la cabecera
            let startRow = row.number + 1;
            while (
                ws
                    .getRow(startRow)
                    .values.some((v, i) => i !== 0 && v !== null && v !== undefined && v !== '')
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

/* ───────────────────────── Constructor ─────────────────────────
 * buildExcelAdquisicion({
 *   cabecera : { … },
 *   items    : [{ cantidad, unidad, descripcion, precioUnitario, totalItem }]
 * })
 *   → devuelve un Workbook (ExcelJS) listo para wb.xlsx.write(res)
 * ----------------------------------------------------------------*/
export async function buildExcelAdquisicion({ cabecera: h, items }) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(TEMPLATE);
    const ws = wb.getWorksheet(1); // primera hoja

    /* 1. Sustitución por marcadores {{TAG}} ------------------------------- */
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

    /* 2. Relleno por etiquetas “visuales” ------------------------------- */
    const labelMap = {
        'UNIDAD SOLICITANTE': h.unidadSolicitante,
        'CENTRO DE COSTO': h.centroCosto,
        RESPONSABLE: h.responsable,
        'NRO. CODIGO DE INVERSION': h.codigoInversion,
    };

    ws.eachRow((row) =>
        row.eachCell((cell) => {
            const txt = norm(cell.value);
            Object.entries(labelMap).forEach(([label, value]) => {
                if (txt.startsWith(label) && !value?.toString().trim() === false) {
                    putNext(ws, cell, value);
                }
            });

            // FECHA EMISION DEL PEDIDO  → día | mes | año
            if (txt.startsWith('FECHA EMISION DEL PEDIDO')) {
                ws.getCell(cell.row, cell.col + 1).value = h.fechaEmision.dia;
                ws.getCell(cell.row, cell.col + 2).value = h.fechaEmision.mes;
                ws.getCell(cell.row, cell.col + 4).value = h.fechaEmision.anio; // salta la celda fusionada ‘/’
            }
        })
    );

    /* 3. Volcado dinámico de ítems --------------------------------------- */
    const { startRow, cols } = locateTable(ws);
    let r = startRow;

    items.forEach((it) => {
        const row = ws.getRow(r++);
        row.getCell(cols.cantidad).value = it.cantidad;
        row.getCell(cols.unidad).value = it.unidad;
        row.getCell(cols.descripcion).value = it.descripcion;
        row.getCell(cols.precio).value = it.precioUnitario;
        row.getCell(cols.total).value = it.totalItem;
        row.commit(); // ⑤ graba la fila en memoria
    });

    return wb;
}
