import { getConnection } from "../database/connection.js";
import sql from 'mssql';

export const updateEstadoInsumoAveriado = async (req, res) => {
    const pool = await getConnection();
    const transaction = new sql.Transaction(pool);
    let transactionStarted = false;

    try {
        const { id } = req.params;
        const { estado, observaciones = '' } = req.body;

        const estadosPermitidos = ['sin reparacion', 'mantenimiento', 'ya reparado'];
        if (!estado || !estadosPermitidos.includes(estado)) {
            return res.status(400).json({
                message: `Estado inválido. Los estados permitidos son: ${estadosPermitidos.join(', ')}`
            });
        }

        await transaction.begin();
        transactionStarted = true;

        const averiadoResult = await new sql.Request(transaction)
            .input('id', sql.Int, id)
            .query(`
                SELECT id_averiado, id_insumo, cantidad, estado
                FROM InsumosAveriados WITH (UPDLOCK, ROWLOCK)
                WHERE id_averiado = @id
            `);

        if (averiadoResult.recordset.length === 0) {
            await transaction.rollback();
            return res.status(404).json({ message: "Registro de insumo averiado no encontrado" });
        }

        const averiado = averiadoResult.recordset[0];
        const estadoAnterior = averiado.estado;

        if (estado !== estadoAnterior) {
            if (estado === 'ya reparado' && estadoAnterior !== 'ya reparado') {
                await new sql.Request(transaction)
                    .input('id_insumo', sql.Int, averiado.id_insumo)
                    .input('cantidad', sql.Int, averiado.cantidad)
                    .query(`
                        UPDATE Insumos
                        SET stock_actual = stock_actual + @cantidad
                        WHERE id_insumo = @id_insumo
                    `);

                await new sql.Request(transaction)
                    .input('id_insumo', sql.Int, averiado.id_insumo)
                    .input('cantidad', sql.Int, averiado.cantidad)
                    .input('responsable', sql.VarChar(100), 'Sistema Reparación')
                    .query(`
                        INSERT INTO MovimientosInventario (
                            id_insumo,
                            tipo_movimiento,
                            cantidad,
                            responsable
                        ) VALUES (
                            @id_insumo,
                            'REPARACION',
                            @cantidad,
                            @responsable
                        )
                    `);
            }

            if (estadoAnterior === 'ya reparado' && estado !== 'ya reparado') {
                const stockResult = await new sql.Request(transaction)
                    .input('id_insumo', sql.Int, averiado.id_insumo)
                    .query('SELECT stock_actual FROM Insumos WHERE id_insumo = @id_insumo');

                if (stockResult.recordset[0].stock_actual < averiado.cantidad) {
                    await transaction.rollback();
                    return res.status(400).json({
                        message: `Stock insuficiente para revertir el estado`,
                        id_insumo: averiado.id_insumo,
                        stock_actual: stockResult.recordset[0].stock_actual,
                        cantidad_requerida: averiado.cantidad
                    });
                }

                await new sql.Request(transaction)
                    .input('id_insumo', sql.Int, averiado.id_insumo)
                    .input('cantidad', sql.Int, averiado.cantidad)
                    .query(`
                        UPDATE Insumos
                        SET stock_actual = stock_actual - @cantidad
                        WHERE id_insumo = @id_insumo
                    `);
            }
        }

        await new sql.Request(transaction)
            .input('id', sql.Int, id)
            .input('estado', sql.VarChar(20), estado)
            .input('observaciones', sql.Text, observaciones)
            .input('fecha_actualizacion', sql.DateTime, new Date())
            .query(`
                UPDATE InsumosAveriados
                SET estado = @estado,
                    observaciones = @observaciones,
                    fecha_actualizacion = @fecha_actualizacion
                WHERE id_averiado = @id
            `);

        await transaction.commit();

        res.json({
            message: "Estado actualizado exitosamente",
            id_averiado: id,
            estado_anterior: estadoAnterior,
            nuevo_estado: estado,
            stock_actualizado: estado === 'ya reparado' && estadoAnterior !== 'ya reparado'
        });

    } catch (error) {
        if (transactionStarted) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error('Error al hacer rollback:', rollbackError);
            }
        }
        console.error('Error al actualizar estado de insumo averiado:', error);
        res.status(500).json({
            message: "Error interno al procesar la solicitud",
            details: error.message
        });
    }
};

export const getInsumosAveriados = async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request().query(`
            SELECT 
                ia.id_averiado,
                ia.id_solicitud,
                ia.id_insumo,
                ia.cantidad,
                ia.estado,
                ia.fecha_registro,
                ia.fecha_actualizacion,
                ia.observaciones,
                s.id_docente,
                s.id_practica,
                s.id_laboratorio,
                d.nombre + ' ' + d.apellido AS docente_nombre,
                p.titulo AS practica_titulo,
                l.nombre AS laboratorio_nombre,
                i.nombre AS insumo_nombre
            FROM InsumosAveriados ia
            JOIN SolicitudesUso s ON ia.id_solicitud = s.id_solicitud
            JOIN Docentes d ON s.id_docente = d.id_docente
            LEFT JOIN Practicas p ON s.id_practica = p.id_practica
            JOIN Laboratorios l ON s.id_laboratorio = l.id_laboratorio
            JOIN Insumos i ON ia.id_insumo = i.id_insumo
        `);

        res.json(result.recordset);
    } catch (error) {
        console.error('Error al obtener insumos averiados:', error);
        res.status(500).json({ message: "Error al obtener insumos averiados" });
    }
};

export const getInsumoAveriadoById = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getConnection();

        const result = await pool.request()
            .input('id', sql.Int, id)
            .query(`
                SELECT 
                    ia.id_averiado,
                    ia.id_solicitud,
                    ia.id_insumo,
                    ia.cantidad,
                    ia.estado,
                    ia.fecha_registro,
                    ia.fecha_actualizacion,
                    ia.observaciones,
                    s.id_docente,
                    s.id_practica,
                    s.id_laboratorio,
                    d.nombre + ' ' + d.apellido AS docente_nombre,
                    p.titulo AS practica_titulo,
                    l.nombre AS laboratorio_nombre,
                    i.nombre AS insumo_nombre
                FROM InsumosAveriados ia
                JOIN SolicitudesUso s ON ia.id_solicitud = s.id_solicitud
                JOIN Docentes d ON s.id_docente = d.id_docente
                LEFT JOIN Practicas p ON s.id_practica = p.id_practica
                JOIN Laboratorios l ON s.id_laboratorio = l.id_laboratorio
                JOIN Insumos i ON ia.id_insumo = i.id_insumo
                WHERE ia.id_averiado = @id
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ message: "Insumo averiado no encontrado" });
        }

        res.json(result.recordset[0]);
    } catch (error) {
        console.error('Error al obtener insumo averiado por ID:', error);
        res.status(500).json({ message: "Error al obtener insumo averiado" });
    }
};