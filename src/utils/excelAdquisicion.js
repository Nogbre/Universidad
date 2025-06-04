import path              from 'path';
import { fileURLToPath } from 'url';
import ExcelJS           from 'exceljs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE   = path.join(__dirname, '../templates/solicitud.xlsx');

/* ───────────────────────── Helpers ───────────────────────── */

/** normaliza texto p/ comparaciones: mayúsculas, sin tildes, sin espacios extras */
const norm = (txt = '') =>
    txt.toString()
        .toUpperCase()
        .normalize('NFD')           // quita acentos
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

/** Reemplaza {{TAG}} o {{ TAG }} en una celda manteniendo el resto del texto */
function put(cell, tag, value = '') {
    if (typeof cell.value !== 'string') return;
    const re = new RegExp(`{{\\s*${tag}\\s*}}`, 'gi');
    if (re.test(cell.value)) cell.value = cell.value.replace(re, value);
}

/* -------------------------------------------------------------------------
 * Localiza la fila de cabeceras   (CANTIDAD | UNIDAD | DESCRIPCIÓN | P/U | …)
 * Devuelve:
 *   { startRow, cols:{ cantidad, unidad, descripcion, precio, total } }
 *  • startRow   → primera fila libre **después** de la cabecera
 *  • cols.*     → nº de columna (1-based) donde debe ir cada dato
 * -------------------------------------------------------------------------*/
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

        row.eachCell(cell => {
            const txt = norm(cell.value);
            Object.entries(headerKeys).forEach(([key, options]) => {
                if (options.some(o => txt === o)) map[key] = cell.col;          // guarda col
            });
        });

        // ¿encontramos TODAS las cabeceras?
        if (Object.keys(headerKeys).every(k => map[k] !== undefined)) {
            /* ——— startRow = la primera fila **vacía** justo después de la cabecera ——— */
            let startRow = row.number + 1;
            while (ws.getRow(startRow).values.some(v => v !== null && v !== undefined && v !== '')) {
                startRow++;                             // salta rótulos/espacios hasta fila realmente vacía
            }
            return { startRow, cols: map };
        }
    }
    throw new Error('No se encontró la fila de cabeceras de la tabla de ítems');
}

/* ───────────────────────── Constructor ───────────────────────── */

export async function buildExcelAdquisicion({ cabecera: h, items }) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(TEMPLATE);
    const ws = wb.getWorksheet(1);

    /* 1. Marcadores de texto simples --------------------------------------------------- */
    ws.eachRow(row => row.eachCell(cell => {
        put(cell, 'UNIDAD_SOLICITANTE', h.unidadSolicitante);
        put(cell, 'RESPONSABLE',        h.responsable);
        put(cell, 'CENTRO_COSTO',       h.centroCosto);
        put(cell, 'CODIGO_INVERSION',   h.codigoInversion);
        put(cell, 'FECHA_DIA',          String(h.fechaEmision.dia).padStart(2,'0'));
        put(cell, 'FECHA_MES',          String(h.fechaEmision.mes).padStart(2,'0'));
        put(cell, 'FECHA_ANIO',         h.fechaEmision.anio);
        put(cell, 'JUSTIFICACION',      h.justificacion);
        put(cell, 'OBSERVACIONES',      h.observaciones);
        put(cell, 'MONTO_TOTAL',        h.montoTotal.toLocaleString('es-BO',{minimumFractionDigits:2}));
        put(cell, 'MONTO_LETRAS',       h.montoLetras);
    }));

    /* 2. Tabla dinámica de ítems ------------------------------------------------------- */
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
