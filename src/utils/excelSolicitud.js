// src/utils/excelSolicitud.js
import path from 'path';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE  = path.join(__dirname, '../templates/plantilla-solicitud.xlsx');

/**
 * Rellena la plantilla L-4 con los datos recibidos.
 *
 * Espera un objeto:
 * {
 *   encabezado: {
 *     sede, facultad, departamento,
 *     asignatura, grupo, gestion,
 *     alumno,  // nombre completo del estudiante
 *     titulo, practica, fecha,          // fecha en formato dd/mm/aaaa (string)
 *     docente, observaciones
 *   },
 *   insumos: [
 *     { nombre, cantidad, categoria }   // categoria: INTEGRADOS | RESISTENCIAS | CAPACITORES | OTROS
 *   ]
 * }
 */
export async function buildExcel(data) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(TEMPLATE);
    const ws = wb.getWorksheet(1);        // Hoja 1

    /* ───────────────────────── 1. Encabezado ───────────────────────── */
    const h = data.encabezado;

    // Fila 19
    ws.getCell('J19').value = `SEDE / SUB SEDE: ${h.sede        ?? ''}`;
    ws.getCell('N19').value = `FACULTAD: ${h.facultad           ?? ''}`;
    ws.getCell('S19').value = `DEPARTAMENTO: ${h.departamento   ?? ''}`;

    // Fila 20
    ws.getCell('J20').value = `ASIGNATURA: ${h.asignatura ?? ''}`;
    ws.getCell('S20').value = `GRUPO: ${h.group ?? h.grupo ?? ''}`;
    ws.getCell('U20').value = `GESTIÓN: ${h.gestion ?? ''}`;

    // Fila 21  → Estudiante
    ws.getCell('J21').value = `ESTUDIANTE: ${h.alumno ?? ''}`;

    // Fila 22  → Título, práctica, fecha
    ws.getCell('J22').value = `TÍTULO: ${h.titulo   ?? ''}`;
    ws.getCell('R22').value = `PRÁCTICA Nº: ${h.practica ?? ''}`;
    ws.getCell('U22').value = `FECHA: ${h.fecha     ?? ''}`;

    // Fila 23  → Docente
    ws.getCell('J23').value = `DOCENTE: ${h.docente ?? ''}`;

    // Fila 24  → Observaciones
    ws.getCell('J24').value = h.observaciones ?? '';

    /* ───────────────────────── 2. Tabla de insumos ───────────────────────── */
    /**
     * Bloques impresos en la plantilla (fila-cabecera 24):
     * INTEGRADOS  |  RESISTENCIAS  |  CAPACITORES  |  OTROS
     * Cada bloque ocupa dos columnas: Cantidad y Nombre del insumo.
     *
     * Columna-cantidad : J | N | R | V
     * Columna-nombre   : K | O | S | W
     * Primera fila libre: 25
     */
    const colMap = {
        INTEGRADOS:   { qty: 'J', name: 'K' },
        RESISTENCIAS: { qty: 'N', name: 'O' },
        CAPACITORES:  { qty: 'R', name: 'S' },
        OTROS:        { qty: 'V', name: 'W' }
    };

    const nextRow = { INTEGRADOS: 25, RESISTENCIAS: 25, CAPACITORES: 25, OTROS: 25 };

    data.insumos.forEach(({ nombre, cantidad, categoria = 'OTROS' }) => {
        const key = categoria.toUpperCase();
        const map = colMap[key] || colMap.OTROS;
        const row = nextRow[key]++;

        ws.getCell(`${map.qty}${row}`).value  = cantidad;
        ws.getCell(`${map.name}${row}`).value = nombre;
    });

    return wb;
}
