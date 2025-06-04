/* ──────────────────────────────────────────────────────────────────────
 *  src/utils/excelAdquisicion.js
 *  Genera la planilla “Solicitud de Adquisición de Activos” a partir de
 *  una plantilla Excel con marcadores {{TAG}} y una tabla dinámica de
 *  ítems.  NO elimines ninguno de los comentarios numerados (①, ②…) :
 *  sirven para documentar pasos clave del algoritmo.
 * ────────────────────────────────────────────────────────────────────── */

import path              from 'path';
import { fileURLToPath } from 'url';
import ExcelJS           from 'exceljs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE   = path.join(__dirname, '../templates/solicitud.xlsx');

/* ───────────────────────── Helpers ───────────────────────── */

/** ① normaliza texto para comparaciones: mayúsculas, sin tildes, sin espacios extras */
const norm = (txt) =>
    (txt ?? '')                        // asegura string no-nulo
        .toString()
        .toUpperCase()
        .normalize('NFD')                // quita acentos
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

/** ② Reemplaza {{TAG}} o {{ TAG }} en una celda manteniendo el resto del texto */
function put(cell, tag, value = '') {
    if (typeof cell.value !== 'string') return;
    const re = new RegExp(`{{\\s*${tag}\\s*}}`, 'gi');
    if (re.test(cell.value)) cell.value = cell.value.replace(re, value);
}

/* -------------------------------------------------------------------------
 * Localiza la fila de cabeceras   (CANTIDAD | UNIDAD | DESCRIPCIÓN | P/U | …)
 * Devuelve:
 *   {
 *     startRow,                 // primera fila 100 % vacía después de cabeceras
 *     cols:{                    // índices de columna para cada campo
 *       cantidad, unidad, descripcion, precio, total
 *     }
 *   }
 * -------------------------------------------------------------------------*/
function locateTable(ws) {
    const headerKeys = {
        cantidad   : ['CANTIDAD', 'CANT'],
        unidad     : ['UNIDAD', 'UND'],
        descripcion: ['DESCRIPCION', 'DESCRIPCIÓN', 'DESC'],
        precio     : ['P/U', 'PU', 'PRECIO UNITARIO'],
        total      : ['TOTAL', 'VALOR TOTAL']
    };

    /* recorre TODAS las filas físicas de la hoja */
    for (const row of ws._rows.filter(Boolean)) {
        const map = {};

        row.eachCell((cell, colNumber) => {
            const txt = norm(cell.value);
            if (!txt) return;                       // ③ ignora celdas vacías

            /* intenta casar cada celda con alguno de los encabezados esperados */
            Object.entries(headerKeys).forEach(([key, options]) => {
                if (options.some(o => txt === o)) map[key] = colNumber;
            });
        });

        /* ¿encontramos TODAS las cabeceras? */
        if (Object.keys(headerKeys).every(k => map[k] !== undefined)) {
            /* ——— primera fila completamente vacía DESPUÉS de la cabecera ——— */
            let startRow = row.number + 1;
            while (
                ws.getRow(startRow).values.some(
                    (v, i) => i !== 0 && v !== null && v !== undefined && v !== ''
                )
                ) {
                startRow++;
            }
            return { startRow, cols: map };
        }
    }

    /* si llegamos aquí algo está mal con la plantilla */
    throw new Error(
        'No se encontró la fila de cabeceras de la tabla de ítems (CANTIDAD | UNIDAD | …)'
    );
}

/* ───────────────────────── Constructor ─────────────────────────
 * buildExcelAdquisicion({
 *   cabecera : { … },
 *   items    : [{ cantidad, unidad, descripcion, precioUnitario, totalItem }]
 * })
 *   → devuelve un Workbook (ExcelJS) listo para .xlsx.write(res)
 * ----------------------------------------------------------------*/
export async function buildExcelAdquisicion({ cabecera: h, items }) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(TEMPLATE);
    const ws = wb.getWorksheet(1);                       // primera hoja

    /* 1. Marcadores simples --------------------------------------------------- */
    ws.eachRow(row =>
        row.eachCell(cell => {
            put(cell, 'UNIDAD_SOLICITANTE', h.unidadSolicitante);
            put(cell, 'RESPONSABLE',        h.responsable);
            put(cell, 'CENTRO_COSTO',       h.centroCosto);
            put(cell, 'CODIGO_INVERSION',   h.codigoInversion);
            put(cell, 'FECHA_DIA',          String(h.fechaEmision.dia).padStart(2, '0'));
            put(cell, 'FECHA_MES',          String(h.fechaEmision.mes).padStart(2, '0'));
            put(cell, 'FECHA_ANIO',         h.fechaEmision.anio);
            put(cell, 'JUSTIFICACION',      h.justificacion);
            put(cell, 'OBSERVACIONES',      h.observaciones);
            put(
                cell,
                'MONTO_TOTAL',
                h.montoTotal.toLocaleString('es-BO', { minimumFractionDigits: 2 })
            );
            put(cell, 'MONTO_LETRAS',       h.montoLetras);
        })
    );

    /* 2. Volcado dinámico de ítems ------------------------------------------- */
    const { startRow, cols } = locateTable(ws);
    let r = startRow;

    items.forEach(it => {
        const row = ws.getRow(r++);
        row.getCell(cols.cantidad   ).value = it.cantidad;
        row.getCell(cols.unidad     ).value = it.unidad;
        row.getCell(cols.descripcion).value = it.descripcion;
        row.getCell(cols.precio     ).value = it.precioUnitario;
        row.getCell(cols.total      ).value = it.totalItem;
        row.commit();                               // ④ graba la fila en memoria
    });

    return wb;
}
