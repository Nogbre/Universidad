// src/utils/excelSolicitud.js
import path from 'path';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE  = path.join(__dirname, '../templates/plantilla-solicitud.xlsx');

/**
 * Rellena la plantilla L-4 con los datos recibidos.
 * @param {Object} data { encabezado: {...}, insumos: [...] }
 * @returns {ExcelJS.Workbook}
 */
export async function buildExcel(data) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(TEMPLATE);
    const ws = wb.getWorksheet(1);           // Hoja 1

    /* ───────────────────── 1. Encabezado ───────────────────── */
    const h = data.encabezado;

    // Fila 19
    ws.getCell('J19').value = `SEDE / SUB SEDE: ${h.sede ?? ''}`;
    ws.getCell('N19').value = `FACULTAD: ${h.facultad ?? ''}`;
    ws.getCell('S19').value = `DEPARTAMENTO: ${h.departamento ?? ''}`;

    // Fila 20
    ws.getCell('J20').value = `ASIGNATURA: ${h.asignatura ?? ''}`;
    ws.getCell('S20').value = `GRUPO: ${h.grupo ?? ''}`;
    ws.getCell('U20').value = `GESTIÓN: ${h.gestion ?? ''}`;

    // Fila 21  → Alumno
    ws.getCell('J21').value = `ESTUDIANTE: ${h.alumno ?? ''}`;

    // Fila 22  → Título, práctica, fecha
    ws.getCell('J22').value = `TÍTULO: ${h.titulo ?? ''}`;
    ws.getCell('R22').value = `PRÁCTICA Nº: ${h.practica ?? ''}`;
    ws.getCell('U22').value = `FECHA: ${h.fecha ?? ''}`;

    // Fila 23  → Docente
    ws.getCell('J23').value = `DOCENTE: ${h.docente ?? ''}`;

    // Fila 24  → Observaciones
    ws.getCell('J24').value = h.observaciones ?? '';

    /* ───────────────────── 2. Tabla de insumos ───────────────────── */
    /**
     * data.insumos: [{ nombre, cantidad, categoria }]
     * Categorías válidas: INTEGRADOS | RESISTENCIAS | CAPACITORES | OTROS
     */
    const colMap = {
        INTEGRADOS:   { qty: 'J', name: 'K' },
        RESISTENCIAS: { qty: 'N', name: 'O' },
        CAPACITORES:  { qty: 'R', name: 'S' },
        OTROS:        { qty: 'V', name: 'W' }
    };

    // Primera fila libre para cada bloque
    const nextRow = { INTEGRADOS: 25, RESISTENCIAS: 25, CAPACITORES: 25, OTROS: 25 };

    data.insumos.forEach(({ nombre, cantidad, categoria = 'OTROS' }) => {
        const cat  = categoria.toUpperCase();
        const map  = colMap[cat] ?? colMap.OTROS;
        const row  = nextRow[cat]++;

        ws.getCell(`${map.qty}${row}`).value  = cantidad;
        ws.getCell(`${map.name}${row}`).value = nombre;
    });

    return wb;
}
