import { getConnection } from "../database/connection.js";
import sql from 'mssql';

export const getMovimientos = async (req, res) => {
    try {
        const { tipo, fechaInicio, fechaFin, page = 1, pageSize = 10 } = req.query;
        const pool = await getConnection();
        const request = pool.request();

        let query = `
            SELECT 
                m.id_movimiento,
                m.tipo_movimiento,
                m.fecha_entregado,
                m.fecha_devuelto,
                m.cantidad,
                m.responsable,
                m.id_solicitud,
                i.nombre AS insumo_nombre
            FROM MovimientosInventario m
            LEFT JOIN Insumos i ON m.id_insumo = i.id_insumo
        `;

        const whereClauses = [];

        if (tipo) {
            whereClauses.push('m.tipo_movimiento = @tipo');
            request.input('tipo', sql.VarChar(20), tipo.toUpperCase());
        }

        if (fechaInicio && fechaFin) {
            whereClauses.push('m.fecha_entregado BETWEEN @fechaInicio AND @fechaFin');
            request.input('fechaInicio', sql.DateTime, fechaInicio);
            request.input('fechaFin', sql.DateTime, fechaFin);
        }

        if (whereClauses.length > 0) {
            query += ' WHERE ' + whereClauses.join(' AND ');
        }

        const offset = (parseInt(page) - 1) * parseInt(pageSize);
        query += `
            ORDER BY m.fecha_entregado DESC
            OFFSET ${offset} ROWS
            FETCH NEXT ${pageSize} ROWS ONLY
        `;

        const countQuery = `
            SELECT COUNT(*) AS total 
            FROM MovimientosInventario m
            ${whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : ''}
        `;

        const [movimientos, total] = await Promise.all([
            request.query(query),
            pool.request().query(countQuery)
        ]);

        res.json({
            data: movimientos.recordset,
            paginacion: {
                paginaActual: parseInt(page),
                porPagina: parseInt(pageSize),
                totalRegistros: total.recordset[0].total,
                totalPaginas: Math.ceil(total.recordset[0].total / pageSize)
            }
        });

    } catch (error) {
        console.error('Error al obtener movimientos:', error);
        res.status(500).json({
            message: "Error al obtener movimientos",
            error: error.message
        });
    }
};

export const getMovimientoById = async (req, res) => {
    try {
        const { id } = req.params;

        if (isNaN(id)) {
            return res.status(400).json({
                message: "ID de movimiento inválido"
            });
        }

        const pool = await getConnection();
        const result = await pool.request()
            .input('id_movimiento', sql.Int, id)
            .query(`
                SELECT 
                    m.*,
                    i.nombre AS insumo_nombre,
                    s.estado AS solicitud_estado
                FROM MovimientosInventario m
                LEFT JOIN Insumos i ON m.id_insumo = i.id_insumo
                LEFT JOIN SolicitudesUso s ON m.id_solicitud = s.id_solicitud
                WHERE m.id_movimiento = @id_movimiento
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                message: "Movimiento no encontrado"
            });
        }

        res.json(result.recordset[0]);

    } catch (error) {
        console.error('Error al obtener movimiento:', error);
        res.status(500).json({
            message: "Error al obtener movimiento",
            error: error.message
        });
    }
};

export const deleteAllMovimientos = async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request().query(`DELETE FROM MovimientosInventario`);

        res.status(200).json({
            message: "Todos los movimientos de inventario fueron eliminados exitosamente.",
            filasAfectadas: result.rowsAffected[0]
        });
    } catch (error) {
        console.error("Error al eliminar movimientos:", error);
        res.status(500).json({
            message: "Error al eliminar los movimientos de inventario",
            error: error.message
        });
    }
};