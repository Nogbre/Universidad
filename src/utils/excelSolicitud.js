import path from 'path';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE   = path.join(__dirname, '../templates/plantilla-solicitud.xlsx');

export async function buildExcel(data) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(TEMPLATE);
    const ws = wb.getWorksheet(1);       // Hoja 1 de la plantilla

    /* ─────────────── 1. Encabezado ─────────────── */
    const h = data.encabezado;           // alias corto

    ws.getCell('J19').value = `SEDE/ SUB SEDE: ${h.sede ?? ''}`;
    ws.getCell('N19').value = `FACULTAD: ${h.facultad ?? ''}`;
    ws.getCell('S19').value = `DEPARTAMENTO: ${h.departamento ?? ''}`;

    ws.getCell('J20').value = `ASIGNATURA: ${h.asignatura ?? ''}`;
    ws.getCell('S20').value = `GRUPO: ${h.grupo ?? ''}`;
    ws.getCell('U20').value = `GESTIÓN: ${h.gestion ?? ''}`;

    ws.getCell('J21').value = `TÍTULO: ${h.titulo ?? ''}`;
    ws.getCell('R21').value = `PRÁCTICA Nº: ${h.practica ?? ''}`;
    ws.getCell('U21').value = `FECHA: ${h.fecha ?? ''}`;

    ws.getCell('J22').value = `DOCENTE: ${h.docente ?? ''}`;
    ws.getCell('J23').value = h.observaciones ?? '';

    /* ─────────────── 2. Insumos ────────────────── */
    /**
     * data.insumos = [
     *   { nombre: 'Resistencia 1 kΩ', cantidad: 10, categoria: 'RESISTENCIAS' },
     *   …
     * ]
     */
    const colMap = {
        INTEGRADOS:   { qty: 'J', name: 'K' },
        RESISTENCIAS: { qty: 'N', name: 'O' },
        CAPACITORES:  { qty: 'R', name: 'S' },
        OTROS:        { qty: 'V', name: 'W' }
    };

    // Lleva la cuenta de en qué fila va cada categoría
    const nextRow = { INTEGRADOS: 25, RESISTENCIAS: 25, CAPACITORES: 25, OTROS: 25 };

    data.insumos.forEach((insumo, idx) => {
        const cat = (insumo.categoria ?? 'OTROS').toUpperCase();
        const map = colMap[cat] ?? colMap.OTROS;
        const row = nextRow[cat]++;

        ws.getCell(`${map.qty}${row}`).value  = insumo.cantidad;
        ws.getCell(`${map.name}${row}`).value = insumo.nombre;
    });

    return wb;
}
