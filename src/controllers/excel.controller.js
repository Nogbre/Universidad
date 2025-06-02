// src/utils/excelSolicitud.js
import path from 'path';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE = path.join(__dirname, '../templates/formcompras.xlsx');

/**
 * data = {
 *   encabezado: {
 *     unidadSolicitante, centroCosto, responsable,
 *     fechaEmision: { dia, mes, anio },
 *     destinoJustificacion, observaciones,
 *     montoTotal, montoLetras,
 *     alumno, docente           // ← Añadido
 *   },
 *   insumos: [
 *     { cantidad, unidad, descripcion, pu, total },
 *     …
 *   ]
 * }
 */
export async function buildExcel(data) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(TEMPLATE);
  const ws = wb.getWorksheet(1);

  const h = data.encabezado;

  /* ─────────────── 1. Cabecera fija ─────────────── */
  ws.getCell('C4').value = h.unidadSolicitante ?? '';
  ws.getCell('F4').value = h.centroCosto      ?? '';

  ws.getCell('C6').value = h.responsable      ?? '';
  ws.getCell('E6').value = h.alumno ?? '';              // ← Estudiante (si quieres mostrarlo)
  ws.getCell('G6').value = h.docente ?? '';             // ← Docente (si quieres mostrarlo)

  ws.getCell('C8').value = h.fechaEmision?.dia  ?? '';
  ws.getCell('D8').value = h.fechaEmision?.mes  ?? '';
  ws.getCell('E8').value = h.fechaEmision?.anio ?? '';

  ws.getCell('B10').value = h.destinoJustificacion ?? '';
  ws.getCell('B20').value = h.observaciones        ?? '';

  ws.getCell('F18').value = h.montoTotal   ?? '';
  ws.getCell('B22').value = h.montoLetras  ?? '';

  /* ─────────────── 2. Tabla de insumos ─────────────── */
  let startRow = 13;                        // primera línea de tabla
  data.insumos.forEach((item, idx) => {
    const row = ws.getRow(startRow + idx);
    row.getCell(1).value = item.cantidad;
    row.getCell(2).value = item.unidad;
    row.getCell(3).value = item.descripcion;
    row.getCell(4).value = item.pu;
    row.getCell(5).value = item.total;
    row.commit();
  });

  return wb;
}
