import { getConnection } from "../database/connection.js";
import sql from 'mssql';

export const createSolicitudUso = async (req, res) => {
    let transaction;
    let transactionStarted = false;

    try {
        const {
            id_docente,
            id_practica,
            id_laboratorio,
            fecha_hora_inicio,
            fecha_hora_fin,
            numero_estudiantes,
            tamano_grupo = 3,
            observaciones,
            insumos: insumosManuales
        } = req.body;

        const requiredFields = [
            'id_docente', 'id_laboratorio',
            'fecha_hora_inicio', 'fecha_hora_fin',
            'numero_estudiantes'
        ];

        const missingFields = requiredFields.filter(field => !req.body[field]);
        if (missingFields.length > 0) {
            return res.status(400).json({
                message: `Campos obligatorios faltantes: ${missingFields.join(', ')}`
            });
        }

        if (numero_estudiantes <= 0 || tamano_grupo <= 0) {
            return res.status(400).json({
                message: "Número de estudiantes y tamaño de grupo deben ser mayores a 0"
            });
        }

        const pool = await getConnection();
        transaction = new sql.Transaction(pool);
        await transaction.begin();
        transactionStarted = true;

        const docenteExists = await new sql.Request(transaction)
            .input('id_docente', sql.Int, id_docente)
            .query('SELECT 1 FROM Docentes WHERE id_docente = @id_docente');

        if (!docenteExists.recordset.length) {
            await transaction.rollback();
            return res.status(404).json({ message: "Docente no encontrado" });
        }

        const numero_grupos = Math.ceil(numero_estudiantes / tamano_grupo);
        if (numero_grupos > 50) {
            await transaction.rollback();
            return res.status(400).json({ message: "Número de grupos excede el límite permitido" });
        }

        const solicitudResult = await new sql.Request(transaction)
            .input('id_docente', sql.Int, id_docente)
            .input('id_practica', sql.Int, id_practica)
            .input('id_laboratorio', sql.Int, id_laboratorio)
            .input('fecha_hora_inicio', sql.DateTime, fecha_hora_inicio)
            .input('fecha_hora_fin', sql.DateTime, fecha_hora_fin)
            .input('numero_estudiantes', sql.Int, numero_estudiantes)
            .input('tamano_grupo', sql.Int, tamano_grupo)
            .input('numero_grupos', sql.Int, numero_grupos)
            .input('observaciones', sql.Text, observaciones)
            .query(`
                INSERT INTO SolicitudesUso (
                    id_docente, id_practica, id_laboratorio,
                    fecha_hora_inicio, fecha_hora_fin, numero_estudiantes,
                    tamano_grupo, numero_grupos, observaciones
                )
                    OUTPUT INSERTED.id_solicitud
                VALUES (
                    @id_docente, @id_practica, @id_laboratorio,
                    @fecha_hora_inicio, @fecha_hora_fin, @numero_estudiantes,
                    @tamano_grupo, @numero_grupos, @observaciones
                    )
            `);

        const id_solicitud = solicitudResult.recordset[0].id_solicitud;

        let insumosAFacturar = [];

        if (id_practica) {
            const practicaInsumos = await new sql.Request(transaction)
                .input('id_practica', sql.Int, id_practica)
                .query(`
                    SELECT id_insumo, cantidad_requerida
                    FROM InsumosPorPractica
                    WHERE id_practica = @id_practica
                `);

            if (practicaInsumos.recordset.length === 0) {
                await transaction.rollback();
                return res.status(400).json({
                    message: "La práctica no tiene insumos configurados"
                });
            }

            insumosAFacturar = practicaInsumos.recordset.map(pi => ({
                id_insumo: pi.id_insumo,
                cantidad_por_grupo: pi.cantidad_requerida
            }));

            if (insumosManuales?.length > 0) {
                console.warn('Advertencia: Insumos manuales ignorados por existencia de práctica');
            }
        } else {
            if (!Array.isArray(insumosManuales) || insumosManuales.length === 0) {
                await transaction.rollback();
                return res.status(400).json({ message: "Debe especificar insumos o seleccionar práctica" });
            }
            insumosAFacturar = insumosManuales;
        }

        for (const insumo of insumosAFacturar) {
            if (!insumo.id_insumo || !insumo.cantidad_por_grupo) {
                await transaction.rollback();
                return res.status(400).json({ message: "Formato de insumo inválido" });
            }

            const cantidad_total = insumo.cantidad_por_grupo * numero_grupos;

            const insumoExists = await new sql.Request(transaction)
                .input('id_insumo', sql.Int, insumo.id_insumo)
                .query('SELECT 1 FROM Insumos WHERE id_insumo = @id_insumo');

            if (!insumoExists.recordset.length) {
                await transaction.rollback();
                return res.status(404).json({ message: `Insumo ${insumo.id_insumo} no encontrado` });
            }

            await new sql.Request(transaction)
                .input('id_solicitud', sql.Int, id_solicitud)
                .input('id_insumo', sql.Int, insumo.id_insumo)
                .input('cantidad_por_grupo', sql.Int, insumo.cantidad_por_grupo)
                .input('cantidad_total', sql.Int, cantidad_total)
                .query(`
                    INSERT INTO DetalleSolicitudUso
                        (id_solicitud, id_insumo, cantidad_por_grupo, cantidad_total)
                    VALUES (@id_solicitud, @id_insumo, @cantidad_por_grupo, @cantidad_total)
                `);
        }

        await transaction.commit();

        res.status(201).json({
            id_solicitud,
            message: "Solicitud creada exitosamente",
            detalle: `${insumosAFacturar.length} insumos registrados`
        });

    } catch (error) {
        if (transactionStarted && transaction) await transaction.rollback();

        console.error('Error al crear solicitud:', error);

        const errorMessage = error.number === 2627
            ? "Conflicto de datos: Posible duplicidad"
            : "Error interno al crear solicitud";

        res.status(500).json({
            message: errorMessage,
            details: error.message,
            operation: "CREATE_SOLICITUD_USO"
        });
    }
};

export const getSolicitudesUso = async (req, res) => {
    try {
        const { estado } = req.query;
        const pool = await getConnection();

        let query = `
            SELECT s.*, d.nombre + ' ' + d.apellido as docente_nombre,
                   p.titulo as practica_titulo, l.nombre as laboratorio_nombre
            FROM SolicitudesUso s
                     LEFT JOIN Docentes d ON s.id_docente = d.id_docente
                     LEFT JOIN Practicas p ON s.id_practica = p.id_practica
                     LEFT JOIN Laboratorios l ON s.id_laboratorio = l.id_laboratorio
        `;

        const request = pool.request();
        if (estado) {
            query += " WHERE s.estado = @estado";
            request.input('estado', sql.VarChar(20), estado);
        }

        const result = await request.query(query);
        res.json(result.recordset);

    } catch (error) {
        console.error('Error al obtener solicitudes:', error);
        res.status(500).json({ message: "Error al obtener solicitudes" });
    }
};

export const getSolicitudUsoById = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getConnection();

        const solicitud = await pool.request()
            .input('id', sql.Int, id)
            .query(`
                SELECT s.*, d.nombre + ' ' + d.apellido as docente_nombre,
                       p.titulo as practica_titulo, l.nombre as laboratorio_nombre
                FROM SolicitudesUso s
                         LEFT JOIN Docentes d ON s.id_docente = d.id_docente
                         LEFT JOIN Practicas p ON s.id_practica = p.id_practica
                         LEFT JOIN Laboratorios l ON s.id_laboratorio = l.id_laboratorio
                WHERE s.id_solicitud = @id
            `);

        if (solicitud.recordset.length === 0) {
            return res.status(404).json({ message: "Solicitud no encontrada" });
        }

        const detalles = await pool.request()
            .input('id', sql.Int, id)
            .query(`
                SELECT d.*, i.nombre as insumo_nombre, i.unidad_medida
                FROM DetalleSolicitudUso d
                         JOIN Insumos i ON d.id_insumo = i.id_insumo
                WHERE d.id_solicitud = @id
            `);

        res.json({
            ...solicitud.recordset[0],
            insumos: detalles.recordset
        });

    } catch (error) {
        console.error('Error al obtener solicitud:', error);
        res.status(500).json({ message: "Error al obtener solicitud" });
    }
};

export const updateEstadoSolicitud = async (req, res) => {
    const pool = await getConnection();
    const transaction = new sql.Transaction(pool);
    let transactionStarted = false;

    try {
        const { id } = req.params;
        if (isNaN(id) || !Number.isInteger(Number(id))) {
            return res.status(400).json({
                message: "ID inválido",
                details: "El parámetro ID debe ser un número entero"
            });
        }
        const solicitudId = parseInt(id, 10);

        const { estado } = req.body;
        const estadosPermitidos = ['Pendiente', 'Aprobada', 'Rechazada', 'Completada'];
        if (!estado || !estadosPermitidos.includes(estado)) {
            return res.status(400).json({
                message: "Estado inválido",
                details: `Estados permitidos: ${estadosPermitidos.join(', ')}`
            });
        }

        transaction.isolationLevel = sql.ISOLATION_LEVEL.READ_COMMITTED;
        await transaction.begin();
        transactionStarted = true;

        const solicitud = await new sql.Request(transaction)
            .input('id', sql.Int, solicitudId)
            .query(`
                SELECT estado
                FROM SolicitudesUso
                WHERE id_solicitud = @id
            `);

        if (solicitud.recordset.length === 0) {
            await transaction.rollback();
            return res.status(404).json({ message: "Solicitud no encontrada" });
        }

        const estadoActual = solicitud.recordset[0].estado;

        const estadosValidos = {
            Pendiente: ['Aprobada', 'Rechazada'],
            Aprobada: ['Completada', 'Rechazada'],
            Completada: [],
            Rechazada: []
        };

        if (!estadosValidos[estadoActual].includes(estado)) {
            await transaction.rollback();
            return res.status(400).json({
                message: "Transición de estado inválida",
                details: `De ${estadoActual} a ${estado} no permitido`,
                transiciones_validas: estadosValidos[estadoActual]
            });
        }

        if (estado === 'Aprobada') {
            const detalles = await new sql.Request(transaction)
                .input('id', sql.Int, solicitudId)
                .query(`
                    SELECT d.id_insumo, d.cantidad_total, i.stock_actual
                    FROM DetalleSolicitudUso d
                             JOIN Insumos i ON d.id_insumo = i.id_insumo
                    WHERE d.id_solicitud = @id
                `);

            for (const detalle of detalles.recordset) {
                if (detalle.stock_actual < detalle.cantidad_total) {
                    await transaction.rollback();
                    return res.status(400).json({
                        message: `Stock insuficiente para insumo ${detalle.id_insumo}`,
                        id_insumo: detalle.id_insumo,
                        stock_disponible: detalle.stock_actual,
                        requerido: detalle.cantidad_total
                    });
                }

                await new sql.Request(transaction)
                    .input('id_insumo', sql.Int, detalle.id_insumo)
                    .input('cantidad', sql.Int, detalle.cantidad_total)
                    .query(`
                        UPDATE Insumos
                        SET stock_actual = stock_actual - @cantidad
                        WHERE id_insumo = @id_insumo
                    `);

                await new sql.Request(transaction)
                    .input('id_insumo', sql.Int, detalle.id_insumo)
                    .input('cantidad', sql.Int, detalle.cantidad_total)
                    .input('id_solicitud', sql.Int, solicitudId)
                    .input('responsable', sql.VarChar(100), 'Sistema')
                    .query(`
                        INSERT INTO MovimientosInventario
                            (id_insumo, tipo_movimiento, cantidad, responsable, id_solicitud)
                        VALUES (@id_insumo, 'PRESTAMO', @cantidad, @responsable, @id_solicitud)
                    `);
            }
        }

        if (estado === 'Completada') {
            const detalles = await new sql.Request(transaction)
                .input('id', sql.Int, solicitudId)
                .query(`
                    SELECT id_insumo, cantidad_total
                    FROM DetalleSolicitudUso
                    WHERE id_solicitud = @id
                `);

            for (const detalle of detalles.recordset) {
                await new sql.Request(transaction)
                    .input('id_insumo', sql.Int, detalle.id_insumo)
                    .input('cantidad', sql.Int, detalle.cantidad_total)
                    .query(`
                        UPDATE Insumos
                        SET stock_actual = stock_actual + @cantidad
                        WHERE id_insumo = @id_insumo
                    `);

                await new sql.Request(transaction)
                    .input('id_insumo', sql.Int, detalle.id_insumo)
                    .input('cantidad', sql.Int, detalle.cantidad_total)
                    .input('id_solicitud', sql.Int, solicitudId)
                    .input('responsable', sql.VarChar(100), 'Sistema')
                    .query(`
                        INSERT INTO MovimientosInventario
                            (id_insumo, tipo_movimiento, cantidad, responsable, id_solicitud)
                        VALUES (@id_insumo, 'DEVOLUCION', @cantidad, @responsable, @id_solicitud)
                    `);
            }
        }

        await new sql.Request(transaction)
            .input('id', sql.Int, solicitudId)
            .input('estado', sql.VarChar(20), estado)
            .query(`
                UPDATE SolicitudesUso
                SET estado = @estado
                WHERE id_solicitud = @id
            `);

        await transaction.commit();

        res.json({
            message: "Estado actualizado exitosamente",
            nuevoEstado: estado,
            estadoAnterior: estadoActual
        });

    } catch (error) {
        if (transactionStarted) await transaction.rollback();
        console.error('Error al actualizar estado:', error);
        res.status(500).json({
            message: "Error interno al procesar la solicitud",
            details: error.message,
            operation: "UPDATE_ESTADO_SOLICITUD"
        });
    }
};

export const devolverSolicitud = async (req, res) => {
    const pool = await getConnection();
    const transaction = new sql.Transaction(pool);
    let transactionStarted = false;

    try {
        const { id } = req.params;

        if (isNaN(id) || !Number.isInteger(Number(id))) {
            return res.status(400).json({
                message: "ID inválido",
                details: "El ID debe ser un número entero"
            });
        }
        const solicitudId = parseInt(id, 10);

        await transaction.begin();
        transactionStarted = true;

        const solicitud = await new sql.Request(transaction)
            .input('id', sql.Int, solicitudId)
            .query(`
                SELECT estado
                FROM SolicitudesUso
                WHERE id_solicitud = @id
            `);

        if (solicitud.recordset.length === 0) {
            await transaction.rollback();
            return res.status(404).json({ message: "Solicitud no encontrada" });
        }

        if (solicitud.recordset[0].estado !== 'Aprobada') {
            await transaction.rollback();
            return res.status(400).json({
                message: "Solo se pueden devolver solicitudes aprobadas"
            });
        }

        const detalles = await new sql.Request(transaction)
            .input('id', sql.Int, solicitudId)
            .query(`
                SELECT id_insumo, cantidad_total
                FROM DetalleSolicitudUso
                WHERE id_solicitud = @id
            `);

        for (const detalle of detalles.recordset) {
            const updateResult = await new sql.Request(transaction)
                .input('id_insumo', sql.Int, detalle.id_insumo)
                .input('cantidad', sql.Int, detalle.cantidad_total)
                .query(`
                    UPDATE Insumos
                    SET stock_actual = stock_actual + @cantidad
                    WHERE id_insumo = @id_insumo
                `);

            if (updateResult.rowsAffected[0] === 0) {
                await transaction.rollback();
                return res.status(404).json({
                    message: `Insumo ${detalle.id_insumo} no encontrado`
                });
            }

            await new sql.Request(transaction)
                .input('id_insumo', sql.Int, detalle.id_insumo)
                .input('cantidad', sql.Int, detalle.cantidad_total)
                .input('id_solicitud', sql.Int, solicitudId)
                .input('responsable', sql.VarChar(100), 'Sistema')
                .query(`
                    INSERT INTO MovimientosInventario
                        (id_insumo, tipo_movimiento, cantidad, responsable, id_solicitud)
                    VALUES (@id_insumo, 'DEVOLUCION', @cantidad, @responsable, @id_solicitud)
                `);
        }

        await new sql.Request(transaction)
            .input('id', sql.Int, solicitudId)
            .query(`
                UPDATE SolicitudesUso
                SET estado = 'Completada'
                WHERE id_solicitud = @id
            `);

        await transaction.commit();
        res.json({
            message: "Devolución completada exitosamente",
            insumosRestaurados: detalles.recordset
        });

    } catch (error) {
        if (transactionStarted) await transaction.rollback();
        console.error('Error al registrar devolución:', error);
        res.status(500).json({
            message: "Error al registrar devolución",
            details: error.message
        });
    }
};

export const getInsumosPorSolicitud = async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('id_solicitud', sql.Int, id)
            .query(`
                SELECT
                    i.id_insumo,
                    i.nombre,
                    i.descripcion,
                    i.ubicacion,
                    i.tipo,
                    i.unidad_medida,
                    dsu.cantidad_por_grupo,
                    dsu.cantidad_total
                FROM DetalleSolicitudUso dsu
                         JOIN Insumos i ON dsu.id_insumo = i.id_insumo
                WHERE dsu.id_solicitud = @id_solicitud
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ message: "No se encontraron insumos para esta solicitud" });
        }

        res.json(result.recordset);
    } catch (error) {
        console.error("Error al obtener insumos por solicitud:", error);
        res.status(500).json({ message: "Error al obtener insumos por solicitud" });
    }
};

export const getPracticasConInsumos = async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .query(`
                SELECT
                    p.id_practica,
                    p.titulo,
                    i.nombre as insumo,
                    ip.cantidad_requerida,
                    i.unidad_medida
                FROM Practicas p
                         JOIN InsumosPorPractica ip ON p.id_practica = ip.id_practica
                         JOIN Insumos i ON ip.id_insumo = i.id_insumo
            `);

        res.json(result.recordset);
    } catch (error) {
        console.error('Error al obtener prácticas:', error);
        res.status(500).json({ message: "Error al obtener prácticas" });
    }
};

