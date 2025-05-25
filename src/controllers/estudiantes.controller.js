import { getConnection } from "../database/connection.js";
import sql from 'mssql';
import bcrypt from 'bcryptjs';

export const createEstudiante = async (req, res) => {
    try {
        const {
            nombre,
            apellido,
            correo,
            contrasena,
            facultad,
            id_carrera,
            id_materia
        } = req.body;

        const requiredFields = [
            'nombre', 'apellido', 'correo',
            'contrasena', 'facultad',
            'id_carrera', 'id_materia'
        ];

        const missingFields = requiredFields.filter(field => !req.body[field]);
        if (missingFields.length > 0) {
            return res.status(400).json({
                message: `Campos faltantes: ${missingFields.join(', ')}`
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(correo)) {
            return res.status(400).json({
                message: "Formato de correo inválido"
            });
        }

        const pool = await getConnection();

        const emailCheck = await pool.request()
            .input('correo', sql.VarChar(100), correo)
            .query('SELECT 1 FROM Estudiantes WHERE correo = @correo');

        if (emailCheck.recordset.length > 0) {
            return res.status(409).json({
                message: "El correo ya está registrado"
            });
        }

        const carreraExists = await pool.request()
            .input('id_carrera', sql.Int, id_carrera)
            .query('SELECT 1 FROM Carreras WHERE id_carrera = @id_carrera');

        if (!carreraExists.recordset.length) {
            return res.status(404).json({
                message: "Carrera no encontrada"
            });
        }

        const materiaExists = await pool.request()
            .input('id_materia', sql.Int, id_materia)
            .query('SELECT 1 FROM Materias WHERE id_materia = @id_materia');

        if (!materiaExists.recordset.length) {
            return res.status(404).json({
                message: "Materia no encontrada"
            });
        }

        const hashedPassword = await bcrypt.hash(contrasena, 10);

        const result = await pool.request()
            .input('nombre', sql.VarChar(100), nombre)
            .input('apellido', sql.VarChar(100), apellido)
            .input('correo', sql.VarChar(100), correo)
            .input('contrasena', sql.VarChar(100), hashedPassword)
            .input('facultad', sql.VarChar(100), facultad)
            .input('id_carrera', sql.Int, id_carrera)
            .input('id_materia', sql.Int, id_materia)
            .query(`
                INSERT INTO Estudiantes 
                    (nombre, apellido, correo, contrasena, facultad, id_carrera, id_materia)
                OUTPUT INSERTED.id_estudiante
                VALUES 
                    (@nombre, @apellido, @correo, @contrasena, @facultad, @id_carrera, @id_materia)
            `);

        res.status(201).json({
            id_estudiante: result.recordset[0].id_estudiante,
            message: "Estudiante registrado exitosamente"
        });

    } catch (error) {
        console.error('Error en createEstudiante:', error);

        const statusCode = error.number === 2627 ? 409 : 500;
        const message = error.number === 2627
            ? "Conflicto: El correo ya está registrado"
            : "Error interno del servidor";

        res.status(statusCode).json({
            message,
            error: error.message,
            operation: "CREATE_ESTUDIANTE"
        });
    }
};

export const createSolicitudEstudiante = async (req, res) => {
    let transaction;
    try {
        const {
            id_estudiante,
            id_materia,
            fecha_hora_inicio,
            fecha_hora_fin,
            observaciones,
            insumos
        } = req.body;

        const requiredFields = [
            'id_estudiante',
            'id_materia',
            'fecha_hora_inicio',
            'insumos'
        ];

        const missingFields = requiredFields.filter(field => !req.body[field]);
        if (missingFields.length > 0) {
            return res.status(400).json({
                message: `Campos faltantes: ${missingFields.join(', ')}`
            });
        }

        const pool = await getConnection();
        transaction = new sql.Transaction(pool);
        await transaction.begin();

        const estudiante = await new sql.Request(transaction)
            .input('id_estudiante', sql.Int, id_estudiante)
            .query(`
                SELECT id_carrera
                FROM Estudiantes
                WHERE id_estudiante = @id_estudiante
            `);

        if (!estudiante.recordset.length) {
            await transaction.rollback();
            return res.status(404).json({
                message: "Estudiante no encontrado",
                details: `ID: ${id_estudiante} no registrado`
            });
        }

        const solicitudResult = await new sql.Request(transaction)
            .input('id_estudiante', sql.Int, id_estudiante)
            .input('id_carrera', sql.Int, estudiante.recordset[0].id_carrera)
            .input('id_materia', sql.Int, id_materia)
            .input('fecha_hora_inicio', sql.DateTime, new Date(fecha_hora_inicio))
            .input('fecha_hora_fin', sql.DateTime, fecha_hora_fin ? new Date(fecha_hora_fin) : null)
            .input('observaciones', sql.Text, observaciones)
            .query(`
                INSERT INTO SolicitudesEstudiantes (
                    id_estudiante, id_carrera, id_materia,
                    fecha_hora_inicio, fecha_hora_fin, observaciones
                )
                    OUTPUT INSERTED.id_solicitud
                VALUES (
                    @id_estudiante, @id_carrera, @id_materia,
                    @fecha_hora_inicio, @fecha_hora_fin, @observaciones
                    )
            `);

        const id_solicitud = solicitudResult.recordset[0].id_solicitud;

        for (const insumo of insumos) {
            if (!insumo.id_insumo || !insumo.cantidad_solicitada) {
                await transaction.rollback();
                return res.status(400).json({
                    message: "Formato de insumo inválido",
                    details: "Cada insumo debe tener id_insumo y cantidad_solicitada"
                });
            }

            const insumoExists = await new sql.Request(transaction)
                .input('id_insumo', sql.Int, insumo.id_insumo)
                .query('SELECT 1 FROM Insumos WHERE id_insumo = @id_insumo');

            if (!insumoExists.recordset.length) {
                await transaction.rollback();
                return res.status(404).json({
                    message: "Insumo no encontrado",
                    id_insumo: insumo.id_insumo
                });
            }

            await new sql.Request(transaction)
                .input('id_solicitud', sql.Int, id_solicitud)
                .input('id_insumo', sql.Int, insumo.id_insumo)
                .input('cantidad_solicitada', sql.Int, insumo.cantidad_solicitada)
                .query(`
                    INSERT INTO DetalleSolicitudEstudiante
                        (id_solicitud, id_insumo, cantidad_solicitada)
                    VALUES (@id_solicitud, @id_insumo, @cantidad_solicitada)
                `);
        }

        await transaction.commit();

        res.status(201).json({
            id_solicitud,
            message: "Solicitud creada exitosamente",
            detalles: {
                insumos_solicitados: insumos.length,
                estudiante_id: id_estudiante
            }
        });

    } catch (error) {
        if (transaction) await transaction.rollback();
        console.error('Error en createSolicitudEstudiante:', error);

        const statusCode = error.number === 2627 ? 409 : 500;
        const message = error.number === 2627
            ? "Conflicto: Solicitud duplicada"
            : "Error interno del servidor";

        res.status(statusCode).json({
            message,
            error: error.message,
            operation: "CREATE_SOLICITUD_ESTUDIANTE"
        });
    }
};

export const getSolicitudesEstudiante = async (req, res) => {
    try {
        const { id_estudiante } = req.query;
        const pool = await getConnection();

        let query = `
            SELECT 
                s.*, 
                c.nombre as carrera_nombre,
                m.nombre as materia_nombre,
                e.nombre + ' ' + e.apellido as estudiante_nombre
            FROM SolicitudesEstudiantes s
            JOIN Carreras c ON s.id_carrera = c.id_carrera
            JOIN Materias m ON s.id_materia = m.id_materia
            JOIN Estudiantes e ON s.id_estudiante = e.id_estudiante
        `;

        const request = pool.request();
        if (id_estudiante) {
            query += " WHERE s.id_estudiante = @id_estudiante";
            request.input('id_estudiante', sql.Int, id_estudiante);
        }

        const result = await request.query(query);
        res.json(result.recordset);

    } catch (error) {
        console.error('Error al obtener solicitudes:', error);
        res.status(500).json({
            message: "Error al obtener solicitudes",
            error: error.message
        });
    }
};

export const getSolicitudEstudianteById = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getConnection();

        const solicitud = await pool.request()
            .input('id', sql.Int, id)
            .query(`
                SELECT 
                    s.*,
                    c.nombre as carrera_nombre,
                    m.nombre as materia_nombre,
                    e.nombre + ' ' + e.apellido as estudiante_nombre
                FROM SolicitudesEstudiantes s
                JOIN Carreras c ON s.id_carrera = c.id_carrera
                JOIN Materias m ON s.id_materia = m.id_materia
                JOIN Estudiantes e ON s.id_estudiante = e.id_estudiante
                WHERE s.id_solicitud = @id
            `);

        if (solicitud.recordset.length === 0) {
            return res.status(404).json({ message: "Solicitud no encontrada" });
        }

        const detalles = await pool.request()
            .input('id', sql.Int, id)
            .query(`
                SELECT 
                    d.*, 
                    i.nombre as insumo_nombre,
                    i.unidad_medida
                FROM DetalleSolicitudEstudiante d
                JOIN Insumos i ON d.id_insumo = i.id_insumo
                WHERE d.id_solicitud = @id
            `);

        res.json({
            ...solicitud.recordset[0],
            insumos: detalles.recordset
        });

    } catch (error) {
        console.error('Error al obtener solicitud:', error);
        res.status(500).json({
            message: "Error al obtener solicitud",
            error: error.message
        });
    }
};

export const updateEstadoSolicitudEstudiante = async (req, res) => {
    const pool = await getConnection();
    const transaction = new sql.Transaction(pool);
    let transactionStarted = false;

    try {
        const { id } = req.params;
        const { estado } = req.body;

        if (isNaN(id)) {
            return res.status(400).json({
                message: "ID inválido",
                details: "El ID debe ser un número"
            });
        }
        const solicitudId = parseInt(id, 10);

        const estadosPermitidos = ['Pendiente', 'Aprobada', 'Rechazada', 'Completada'];
        if (!estadosPermitidos.includes(estado)) {
            return res.status(400).json({
                message: "Estado inválido",
                details: `Estados permitidos: ${estadosPermitidos.join(', ')}`
            });
        }

        await transaction.begin();
        transactionStarted = true;

        const solicitud = await new sql.Request(transaction)
            .input('id', sql.Int, solicitudId)
            .query(`
                SELECT estado
                FROM SolicitudesEstudiantes
                WHERE id_solicitud = @id
            `);

        if (!solicitud.recordset.length) {
            await transaction.rollback();
            return res.status(404).json({ message: "Solicitud no encontrada" });
        }

        const estadoActual = solicitud.recordset[0].estado;

        const transicionesValidas = {
            Pendiente: ['Aprobada', 'Rechazada'],
            Aprobada: ['Completada', 'Rechazada'],
            Completada: [],
            Rechazada: []
        };

        if (!transicionesValidas[estadoActual].includes(estado)) {
            await transaction.rollback();
            return res.status(400).json({
                message: "Transición inválida",
                details: `De ${estadoActual} a ${estado} no permitido`
            });
        }

        if (estado === 'Aprobada') {
            const detalles = await new sql.Request(transaction)
                .input('id', sql.Int, solicitudId)
                .query(`
                    SELECT d.id_insumo, d.cantidad_solicitada, i.stock_actual
                    FROM DetalleSolicitudEstudiante d
                             JOIN Insumos i ON d.id_insumo = i.id_insumo
                    WHERE d.id_solicitud = @id
                `);

            for (const detalle of detalles.recordset) {
                // Validar stock
                if (detalle.stock_actual < detalle.cantidad_solicitada) {
                    await transaction.rollback();
                    return res.status(400).json({
                        message: `Stock insuficiente para insumo ${detalle.id_insumo}`,
                        insumo: detalle.id_insumo,
                        stock_disponible: detalle.stock_actual,
                        cantidad_requerida: detalle.cantidad_solicitada
                    });
                }

                await new sql.Request(transaction)
                    .input('id_insumo', sql.Int, detalle.id_insumo)
                    .input('cantidad', sql.Int, detalle.cantidad_solicitada)
                    .query(`
                        UPDATE Insumos
                        SET stock_actual = stock_actual - @cantidad
                        WHERE id_insumo = @id_insumo
                    `);

                await new sql.Request(transaction)
                    .input('id_insumo', sql.Int, detalle.id_insumo)
                    .input('cantidad', sql.Int, detalle.cantidad_solicitada)
                    .input('id_solicitud_estudiante', sql.Int, solicitudId)
                    .input('responsable', sql.VarChar(100), 'Sistema')
                    .query(`
                        INSERT INTO MovimientosInventario (
                            id_insumo,
                            tipo_movimiento,
                            cantidad,
                            responsable,
                            id_solicitud_estudiante
                        ) VALUES (
                                     @id_insumo,
                                     'PRESTAMO_ESTUDIANTE',
                                     @cantidad,
                                     @responsable,
                                     @id_solicitud_estudiante
                                 )
                    `);
            }
        }

        if (estado === 'Completada') {
            const detalles = await new sql.Request(transaction)
                .input('id', sql.Int, solicitudId)
                .query(`
                    SELECT id_insumo, cantidad_solicitada
                    FROM DetalleSolicitudEstudiante
                    WHERE id_solicitud = @id
                `);

            for (const detalle of detalles.recordset) {
                await new sql.Request(transaction)
                    .input('id_insumo', sql.Int, detalle.id_insumo)
                    .input('cantidad', sql.Int, detalle.cantidad_solicitada)
                    .query(`
                        UPDATE Insumos
                        SET stock_actual = stock_actual + @cantidad
                        WHERE id_insumo = @id_insumo
                    `);

                await new sql.Request(transaction)
                    .input('id_insumo', sql.Int, detalle.id_insumo)
                    .input('cantidad', sql.Int, detalle.cantidad_solicitada)
                    .input('id_solicitud_estudiante', sql.Int, solicitudId)
                    .input('responsable', sql.VarChar(100), 'Sistema')
                    .query(`
                        INSERT INTO MovimientosInventario (
                            id_insumo,
                            tipo_movimiento,
                            cantidad,
                            responsable,
                            id_solicitud_estudiante
                        ) VALUES (
                                     @id_insumo,
                                     'DEVOLUCION_ESTUDIANTE',
                                     @cantidad,
                                     @responsable,
                                     @id_solicitud_estudiante
                                 )
                    `);
            }
        }

        await new sql.Request(transaction)
            .input('id', sql.Int, solicitudId)
            .input('estado', sql.VarChar(20), estado)
            .query(`
                UPDATE SolicitudesEstudiantes
                SET estado = @estado
                WHERE id_solicitud = @id
            `);

        await transaction.commit();

        res.json({
            message: "Estado actualizado exitosamente",
            nuevo_estado: estado,
            estado_anterior: estadoActual,
            detalles: {
                insumos_afectados: estado === 'Aprobada' ? detalles.recordset.length : undefined
            }
        });

    } catch (error) {
        if (transactionStarted) await transaction.rollback();
        console.error('Error al actualizar estado:', error);

        const mensajeError = error.number === 547
            ? "Conflicto de integridad referencial"
            : "Error interno del servidor";

        res.status(500).json({
            message: mensajeError,
            details: error.message,
            operation: "UPDATE_ESTADO_SOLICITUD_ESTUDIANTE"
        });
    }
};