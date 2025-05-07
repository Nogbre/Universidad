import { getConnection } from "../database/connection.js";
import sql from 'mssql';

export const addInsumoAPractica = async (req, res) => {
    const { id_practica } = req.params;
    const { id_insumo, cantidad_requerida } = req.body;

    const pool = await getConnection();
    try {
        const practicaExists = await pool.request()
            .input('id_practica', sql.Int, id_practica)
            .query('SELECT 1 FROM Practicas WHERE id_practica = @id_practica');

        const insumoExists = await pool.request()
            .input('id_insumo', sql.Int, id_insumo)
            .query('SELECT 1 FROM Insumos WHERE id_insumo = @id_insumo');

        if (!practicaExists.recordset.length || !insumoExists.recordset.length) {
            return res.status(404).json({
                message: "Práctica o insumo no encontrado"
            });
        }

        await pool.request()
            .input('id_practica', sql.Int, id_practica)
            .input('id_insumo', sql.Int, id_insumo)
            .input('cantidad_requerida', sql.Int, cantidad_requerida)
            .query(`
                INSERT INTO InsumosPorPractica 
                (id_practica, id_insumo, cantidad_requerida)
                VALUES (@id_practica, @id_insumo, @cantidad_requerida)
            `);

        res.status(201).json({
            message: "Insumo agregado a práctica exitosamente",
            id_practica,
            id_insumo
        });

    } catch (error) {
        console.error('Error al agregar insumo a práctica:', error);

        if (error.number === 2627) {
            res.status(409).json({
                message: "Esta combinación práctica-insumo ya existe"
            });
        } else {
            res.status(500).json({
                message: "Error al agregar insumo a práctica",
                error: error.message
            });
        }
    }
};

export const updateCantidadRequerida = async (req, res) => {
    const { id_practica, id_insumo } = req.params;
    const { cantidad_requerida } = req.body;

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('id_practica', sql.Int, id_practica)
            .input('id_insumo', sql.Int, id_insumo)
            .input('cantidad_requerida', sql.Int, cantidad_requerida)
            .query(`
                UPDATE InsumosPorPractica 
                SET cantidad_requerida = @cantidad_requerida
                WHERE id_practica = @id_practica 
                AND id_insumo = @id_insumo
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                message: "Relación práctica-insumo no encontrada"
            });
        }

        res.json({
            message: "Cantidad requerida actualizada",
            id_practica,
            id_insumo,
            nueva_cantidad: cantidad_requerida
        });

    } catch (error) {
        console.error('Error al actualizar cantidad:', error);
        res.status(500).json({
            message: "Error al actualizar cantidad requerida",
            error: error.message
        });
    }
};

export const getInsumosPorPractica = async (req, res) => {
    const { id_practica } = req.params;

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('id_practica', sql.Int, id_practica)
            .query(`
                SELECT ipp.*, i.nombre as insumo_nombre, i.unidad_medida 
                FROM InsumosPorPractica ipp
                JOIN Insumos i ON ipp.id_insumo = i.id_insumo
                WHERE ipp.id_practica = @id_practica
            `);

        res.json(result.recordset);

    } catch (error) {
        console.error('Error al obtener insumos:', error);
        res.status(500).json({
            message: "Error al obtener insumos de la práctica",
            error: error.message
        });
    }
};

export const getInsumoPracticaById = async (req, res) => {
    const { id_practica, id_insumo } = req.params;

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('id_practica', sql.Int, id_practica)
            .input('id_insumo', sql.Int, id_insumo)
            .query(`
                SELECT ipp.*, i.nombre as insumo_nombre 
                FROM InsumosPorPractica ipp
                JOIN Insumos i ON ipp.id_insumo = i.id_insumo
                WHERE ipp.id_practica = @id_practica 
                AND ipp.id_insumo = @id_insumo
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                message: "Relación práctica-insumo no encontrada"
            });
        }

        res.json(result.recordset[0]);

    } catch (error) {
        console.error('Error al obtener relación:', error);
        res.status(500).json({
            message: "Error al obtener relación",
            error: error.message
        });
    }
};

export const deleteInsumoDePractica = async (req, res) => {
    const { id_practica, id_insumo } = req.params;

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('id_practica', sql.Int, id_practica)
            .input('id_insumo', sql.Int, id_insumo)
            .query(`
                DELETE FROM InsumosPorPractica 
                WHERE id_practica = @id_practica 
                AND id_insumo = @id_insumo
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                message: "Relación práctica-insumo no encontrada"
            });
        }

        res.json({
            message: "Insumo eliminado de la práctica",
            id_practica,
            id_insumo
        });

    } catch (error) {
        console.error('Error al eliminar relación:', error);
        res.status(500).json({
            message: "Error al eliminar insumo de la práctica",
            error: error.message
        });
    }
};