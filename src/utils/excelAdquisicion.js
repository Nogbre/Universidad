// src/utils/excelAdquisicion.js
import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const buildExcelAdquisicion = async (payload) => {
    try {
        // 1. Cargar plantilla
        const templatePath = path.join(__dirname, '../../templates/solicitud_adquisicion_template.xlsx');
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(templatePath);
        const worksheet = workbook.getWorksheet('Solicitud');

        // 2. Obtener rangos fusionados (solución al error)
        const mergedRanges = worksheet._merges
            ? Array.from(worksheet._merges.values())
            : worksheet.mergedCells || [];

        // 3. Función para escribir valores considerando fusiones
        const putNext = (startCell, value, style = {}) => {
            const cell = worksheet.getCell(startCell);
            cell.value = value;

            // Buscar si la celda está fusionada
            const merge = mergedRanges.find(m => m.top <= cell.row &&
                m.bottom >= cell.row &&
                m.left <= cell.col &&
                m.right >= cell.col);

            if (merge) {
                // Escribir solo en la celda superior izquierda del rango fusionado
                if (cell.row === merge.top && cell.col === merge.left) {
                    worksheet.getCell(merge.top, merge.left).value = value;
                    Object.assign(worksheet.getCell(merge.top, merge.left), style);
                }
            } else {
                Object.assign(cell, style);
            }
        };

        // 4. Llenar cabecera (ejemplo)
        putNext('B2', payload.cabecera.unidadSolicitante, { font: { bold: true } });
        putNext('B3', payload.cabecera.responsable);
        putNext('B4', payload.cabecera.fechaCompleta);
        putNext('B5', payload.cabecera.centroCosto);
        putNext('B6', payload.cabecera.codigoInversion);
        putNext('B7', payload.cabecera.justificacion);
        putNext('B8', payload.cabecera.observaciones);
        putNext('B9', `$${payload.cabecera.montoTotal.toFixed(2)}`, { numFmt: '"$"#,##0.00' });
        putNext('B10', payload.cabecera.montoLetras);

        // 5. Llenar items
        let rowIndex = 12; // Fila inicial de items
        payload.items.forEach((item, idx) => {
            putNext(`A${rowIndex}`, idx + 1);
            putNext(`B${rowIndex}`, item.cantidad);
            putNext(`C${rowIndex}`, item.unidad);
            putNext(`D${rowIndex}`, item.descripcion);
            putNext(`E${rowIndex}`, item.precioUnitario, { numFmt: '"$"#,##0.00' });
            putNext(`F${rowIndex}`, item.totalItem, { numFmt: '"$"#,##0.00' });
            rowIndex++;
        });

        // 6. Ajustar filas automáticamente
        worksheet.columns.forEach(column => {
            let maxLength = 0;
            column.eachCell({ includeEmpty: true }, cell => {
                let cellLength = 0;
                if (cell.value) {
                    cellLength = cell.value.toString().length;
                }
                if (cellLength > maxLength) {
                    maxLength = cellLength;
                }
            });
            column.width = Math.min(Math.max(maxLength + 2, 10), 50);
        });

        return workbook;

    } catch (error) {
        console.error('Error al construir Excel:', error);
        throw new Error('Error interno al generar el archivo Excel');
    }
};