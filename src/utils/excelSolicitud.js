// src/utils/excelSolicitud.js
import path from 'path';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE = path.join(__dirname, '../templates/plantilla-solicitud.xlsx');

/**
 * Rellena la plantilla con los datos de la solicitud
 * @param {Object} data  Estructura { encabezado: {...}, insumos: [...] }
 * @returns {ExcelJS.Workbook}  Workbook listo para enviar
 */
export async function buildExcel(data) {
    const wb  = new ExcelJS.Workbook();
    await wb.xlsx.readFile(TEMPLATE);
    const ws  = wb.getWorksheet(1);

    const { encabezado } = data;
    ws.getCell('D5').value  = encabezado.fecha;
    ws.getCell('D7').value  = encabezado.alumno;
    ws.getCell('D8').value  = encabezado.carrera;
    ws.getCell('D9').value  = encabezado.materia;
    ws.getCell('D10').value = encabezado.docente;
    ws.getCell('D11').value = encabezado.observaciones ?? '';

    let start = 15;
    data.insumos.forEach(({ nombre, cantidad }, i) => {
        const row = start + i;
        ws.getCell(`B${row}`).value = i + 1;
        ws.getCell(`C${row}`).value = nombre;
        ws.getCell(`F${row}`).value = cantidad;
    });

    return wb;
}
