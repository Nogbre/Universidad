import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.join(__dirname, '../../templates/formcompras.xlsx');

export const generarExcel = async (req, res) => {
  const {
    unidadSolicitante, centroCosto, responsable, fechaEmision,
    destinoJustificacion, observaciones, montoTotal, montoLetras, insumos
  } = req.body;

  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(TEMPLATE_PATH);
    const ws = wb.getWorksheet(1);

    // Rellenar campos fijos (ajusta las celdas según tu plantilla)
    ws.getCell('C4').value = unidadSolicitante;
    ws.getCell('C6').value = responsable;
    ws.getCell('C8').value = fechaEmision.dia;
    ws.getCell('D8').value = fechaEmision.mes;
    ws.getCell('E8').value = fechaEmision.anio;
    ws.getCell('B10').value = destinoJustificacion;
    ws.getCell('B20').value = observaciones;
    ws.getCell('F18').value = montoTotal;
    ws.getCell('B22').value = montoLetras;

    // Rellenar tabla de insumos
    let startRow = 13;
    insumos.forEach((item, idx) => {
      const row = ws.getRow(startRow + idx);
      row.getCell(1).value = item.cantidad;
      row.getCell(2).value = item.unidad;
      row.getCell(3).value = item.descripcion;
      row.getCell(4).value = item.pu;
      row.getCell(5).value = item.total;
      row.commit();
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="formcompras.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error generando Excel' });
  }
};
