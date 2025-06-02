// src/utils/excelSolicitud.js
import path from 'path';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE  = path.join(__dirname, '../templates/plantilla-solicitud.xlsx');

// Helper: conserva la etiqueta y coloca el valor después del “:”
function inject(cell, value = '') {
    const raw = cell.value ?? '';
    const [prefix] = String(raw).split(':', 1);            // texto antes de “:”
    cell.value = `${prefix}: ${value}`;
}

/**
 * buildExcel(data)
 *  data.encabezado →
 *    { sede, facultad, departamento, asignatura, grupo, gestion,
 *      alumno, titulo, practica, fecha, docente, observaciones }
 *  data.insumos →
 *    [{ nombre, cantidad, categoria }]
 */
export async function buildExcel(data) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(TEMPLATE);
    const ws = wb.getWorksheet(1);

    /* ───────────── 1. Encabezado ───────────── */
    const h = data.encabezado;

    // Fila 19
    inject(ws.getCell('J19'), h.sede);
    inject(ws.getCell('N19'), h.facultad);
    inject(ws.getCell('S19'), h.departamento);

    // Fila 20
    inject(ws.getCell('J20'), h.asignatura);
    inject(ws.getCell('S20'), h.grupo);
    inject(ws.getCell('U20'), h.gestion);

    // Fila 21
    inject(ws.getCell('J21'), h.titulo);        // TÍTULO
    inject(ws.getCell('R21'), h.practica);      // PRÁCTICA Nº

    // Fila 22
    inject(ws.getCell('U22'), h.fecha);         // FECHA

    // Fila 23
    inject(ws.getCell('J22'), h.docente);       // DOCENTE
    inject(ws.getCell('P22'), h.alumno);        // ESTUDIANTE

    // Fila 24
    ws.getCell('J24').value = h.observaciones ?? '';

    /* ───────────── 2. Tabla de insumos ───────────── */
    const colMap = {
        INTEGRADOS:   { qty: 'J', name: 'K' },
        RESISTENCIAS: { qty: 'N', name: 'O' },
        CAPACITORES:  { qty: 'R', name: 'S' },
        OTROS:        { qty: 'V', name: 'W' }
    };
    const nextRow = { INTEGRADOS: 25, RESISTENCIAS: 25, CAPACITORES: 25, OTROS: 25 };

    data.insumos.forEach(({ nombre, cantidad, categoria = 'OTROS' }) => {
        const key  = categoria.toUpperCase();
        const map  = colMap[key] || colMap.OTROS;
        const row  = nextRow[key]++;

        ws.getCell(`${map.qty}${row}`).value  = cantidad;
        ws.getCell(`${map.name}${row}`).value = nombre;
    });

    return wb;
}
