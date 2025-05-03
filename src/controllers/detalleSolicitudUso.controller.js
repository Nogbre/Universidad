import { getConnection } from "../database/connection.js";
import sql from 'mssql';

export const getDetallesBySolicitud = async (req, res) => {
    try {
        const { id_solicitud } = req.params;
        const pool = await getConnection();

        const result = await pool.request()
            .input('id_solicitud', sql.Int, id_solicitud)
            .query(`
                SELECT d.*, i.nombre as insumo_nombre, i.unidad_medida
                FROM DetalleSolicitudUso d
                JOIN Insumos i ON d.id_insumo = i.id_insumo
                WHERE d.id_solicitud = @id_solicitud
            `);

        res.json(result.recordset);
    } catch (error) {
        res.status(500).json({
            message: "Error obteniendo detalles",
            error: error.message
        });
    }
};

export const updateDetalle = async (req, res) => {
    let transaction;
    try {
        const { id_detalle } = req.params;
        const { cantidad_por_grupo } = req.body;
        const pool = await getConnection();
        transaction = new sql.Transaction(pool);

        await transaction.begin();

        const detalle = await new sql.Request(transaction)
            .input('id_detalle', sql.Int, id_detalle)
            .query(`
                SELECT d.*, s.numero_grupos, s.estado 
                FROM DetalleSolicitudUso d
                JOIN SolicitudesUso s ON d.id_solicitud = s.id_solicitud
                WHERE d.id_detalle_solicitud = @id_detalle
            `);

        if (detalle.recordset.length === 0) {
            await transaction.rollback();
            return res.status(404).json({ message: "Detalle no encontrado" });
        }

        const { id_solicitud, estado, cantidad_total: oldTotal } = detalle.recordset[0];
        const nueva_cantidad_total = cantidad_por_grupo * detalle.recordset[0].numero_grupos;

        await new sql.Request(transaction)
            .input('id_detalle', sql.Int, id_detalle)
            .input('cantidad_por_grupo', sql.Int, cantidad_por_grupo)
            .input('nueva_cantidad_total', sql.Int, nueva_cantidad_total)
            .query(`
                UPDATE DetalleSolicitudUso
                SET cantidad_por_grupo = @cantidad_por_grupo,
                    cantidad_total = @nueva_cantidad_total
                WHERE id_detalle_solicitud = @id_detalle
            `);

        if (estado === 'Aprobada') {
            const diferencia = nueva_cantidad_total - oldTotal;

            await new sql.Request(transaction)
                .input('id_insumo', sql.Int, detalle.recordset[0].id_insumo)
                .input('diferencia', sql.Int, diferencia)
                .query(`
                    UPDATE Insumos
                    SET stock_actual = stock_actual - @diferencia
                    WHERE id_insumo = @id_insumo
                `);
        }

        await transaction.commit();
        res.json({ message: "Detalle actualizado correctamente" });

    } catch (error) {
        if (transaction) await transaction.rollback();
        res.status(500).json({
            message: "Error actualizando detalle",
            error: error.message
        });
    }
};

export const deleteDetalle = async (req, res) => {
    let transaction;
    try {
        const { id_detalle } = req.params;
        const pool = await getConnection();
        transaction = new sql.Transaction(pool);

        await transaction.begin();

        const detalle = await new sql.Request(transaction)
            .input('id_detalle', sql.Int, id_detalle)
            .query(`
                SELECT d.*, s.estado 
                FROM DetalleSolicitudUso d
                JOIN SolicitudesUso s ON d.id_solicitud = s.id_solicitud
                WHERE d.id_detalle_solicitud = @id_detalle
            `);

        if (detalle.recordset.length === 0) {
            await transaction.rollback();
            return res.status(404).json({ message: "Detalle no encontrado" });
        }

        const { id_insumo, cantidad_total, estado } = detalle.recordset[0];

        await new sql.Request(transaction)
            .input('id_detalle', sql.Int, id_detalle)
            .query('DELETE FROM DetalleSolicitudUso WHERE id_detalle_solicitud = @id_detalle');

        if (estado === 'Aprobada') {
            await new sql.Request(transaction)
                .input('id_insumo', sql.Int, id_insumo)
                .input('cantidad_total', sql.Int, cantidad_total)
                .query(`
                    UPDATE Insumos
                    SET stock_actual = stock_actual + @cantidad_total
                    WHERE id_insumo = @id_insumo
                `);
        }

        await transaction.commit();
        res.json({ message: "Detalle eliminado correctamente" });

    } catch (error) {
        if (transaction) await transaction.rollback();
        res.status(500).json({
            message: "Error eliminando detalle",
            error: error.message
        });
    }
};