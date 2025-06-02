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
export const getInsumosPrestadosEstudiante = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getConnection();

        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT insumos_prestados FROM Estudiantes WHERE id_estudiante = @id');

        if (!result.recordset.length) {
            return res.status(404).json({ message: "Estudiante no encontrado" });
        }

        const insumosPrestados = result.recordset[0].insumos_prestados;
        const parsedInsumos = insumosPrestados ? JSON.parse(insumosPrestados) : [];

        res.json(parsedInsumos);

    } catch (error) {
        console.error('Error al obtener insumos prestados:', error);
        res.status(500).json({
            message: "Error al obtener insumos prestados",
            error: error.message
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

        const requiredFields = ['id_estudiante', 'id_materia', 'fecha_hora_inicio', 'insumos'];
        const missingFields = requiredFields.filter(field => !req.body[field]);
        if (missingFields.length > 0) {
            return res.status(400).json({
                message: `Campos faltantes: ${missingFields.join(', ')}`
            });
        }

        const pool = await getConnection();
        transaction = new sql.Transaction(pool);
        await transaction.begin();

        const estudianteResult = await new sql.Request(transaction)
            .input('id_estudiante', sql.Int, id_estudiante)
            .query(`
                SELECT id_carrera, insumos_prestados 
                FROM Estudiantes WITH (UPDLOCK) 
                WHERE id_estudiante = @id_estudiante
            `);

        if (!estudianteResult.recordset.length) {
            await transaction.rollback();
            return res.status(404).json({
                message: "Estudiante no encontrado",
                details: `ID: ${id_estudiante} no registrado`
            });
        }

        const estudiante = estudianteResult.recordset[0];
        const id_carrera = estudiante.id_carrera;

        const solicitudResult = await new sql.Request(transaction)
            .input('id_estudiante', sql.Int, id_estudiante)
            .input('id_carrera', sql.Int, id_carrera)
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
        const nuevosInsumosPrestados = [];

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
                .query('SELECT nombre FROM Insumos WHERE id_insumo = @id_insumo');

            if (!insumoExists.recordset.length) {
                await transaction.rollback();
                return res.status(404).json({
                    message: "Insumo no encontrado",
                    id_insumo: insumo.id_insumo
                });
            }

            const nombreInsumo = insumoExists.recordset[0].nombre;

            nuevosInsumosPrestados.push({
                id_insumo: insumo.id_insumo,
                nombre: nombreInsumo,
                cantidad: insumo.cantidad_solicitada,
                id_solicitud: id_solicitud,
                fecha_prestamo: new Date().toISOString()
            });

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

        let insumosActuales = [];
        try {
            insumosActuales = estudiante.insumos_prestados
                ? JSON.parse(estudiante.insumos_prestados)
                : [];
        } catch (e) {
            console.warn("Error al parsear insumos prestados, reiniciando lista");
        }

        const nuevosInsumosCombinados = [...insumosActuales, ...nuevosInsumosPrestados];

        await new sql.Request(transaction)
            .input('id_estudiante', sql.Int, id_estudiante)
            .input('insumos_prestados', sql.NVarChar(sql.MAX), JSON.stringify(nuevosInsumosCombinados))
            .query(`
                UPDATE Estudiantes 
                SET insumos_prestados = @insumos_prestados
                WHERE id_estudiante = @id_estudiante
            `);

        await transaction.commit();

        res.status(201).json({
            id_solicitud,
            message: "Solicitud creada exitosamente",
            detalles: {
                insumos_solicitados: insumos.length,
                estudiante_id: id_estudiante,
                insumos_prestados_actualizados: nuevosInsumosCombinados.length
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
                details: "El ID debe ser un número válido"
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
            if (transactionStarted) {
                try {
                    await transaction.rollback();
                } catch (rollbackError) {
                    console.error('Error en rollback (solicitud no encontrada):', rollbackError);
                }
            }
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
            if (transactionStarted) {
                try {
                    await transaction.rollback();
                } catch (rollbackError) {
                    console.error('Error en rollback (transición inválida):', rollbackError);
                }
            }
            return res.status(400).json({
                message: "Transición inválida",
                details: `Transición de ${estadoActual} a ${estado} no permitida`
            });
        }

        let insumosProcesados = 0;

        if (estado === 'Aprobada') {
            const detalles = await new sql.Request(transaction)
                .input('id', sql.Int, solicitudId)
                .query(`
                    SELECT
                        d.id_insumo,
                        d.cantidad_solicitada,
                        i.stock_actual
                    FROM DetalleSolicitudEstudiante d
                             JOIN Insumos i ON d.id_insumo = i.id_insumo
                    WHERE d.id_solicitud = @id
                `);

            insumosProcesados = detalles.recordset.length;

            for (const detalle of detalles.recordset) {
                if (detalle.stock_actual < detalle.cantidad_solicitada) {
                    if (transactionStarted) {
                        try {
                            await transaction.rollback();
                        } catch (rollbackError) {
                            console.error('Error en rollback (stock insuficiente):', rollbackError);
                        }
                    }
                    return res.status(400).json({
                        message: "Stock insuficiente",
                        details: {
                            insumo: detalle.id_insumo,
                            stock_disponible: detalle.stock_actual,
                            cantidad_requerida: detalle.cantidad_solicitada
                        }
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
                                     'PRESTAMO_EST',
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
                    SELECT
                        id_insumo,
                        cantidad_solicitada
                    FROM DetalleSolicitudEstudiante
                    WHERE id_solicitud = @id
                `);

            insumosProcesados = detalles.recordset.length;

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
                                     'DEVOLUCION_EST',
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
            message: "Estado actualizado correctamente",
            nuevo_estado: estado,
            estado_anterior: estadoActual,
            detalles: {
                insumos_procesados: insumosProcesados
            }
        });

    } catch (error) {
        if (transactionStarted) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                if (rollbackError.code !== 'ENOTBEGUN') {
                    console.error('Error en rollback (catch general):', rollbackError);
                }
            }
        }
        console.error('Error en actualización de estado:', error);

        const statusCode = error.number === 547 ? 409 : 500;
        const errorMessage = error.number === 547
            ? "Conflicto de relaciones en base de datos"
            : "Error interno del servidor";

        res.status(statusCode).json({
            message: errorMessage,
            details: error.message,
            operation: "UPDATE_ESTADO_SOLICITUD_ESTUDIANTE"
        });
    }
};

export const devolverSolicitudEstudiante = async (req, res) => {
    const pool = await getConnection();
    const transaction = new sql.Transaction(pool);
    let transactionStarted = false;

    try {
        const { id } = req.params;
        const { insumos_no_devueltos = [] } = req.body;

        if (isNaN(id) || !Number.isInteger(Number(id))) {
            return res.status(400).json({
                message: "ID inválido",
                details: "El ID debe ser un número entero"
            });
        }

        if (!Array.isArray(insumos_no_devueltos)) {
            return res.status(400).json({
                message: "Formato inválido para insumos no devueltos",
                details: "Debe ser un array de objetos { id_insumo, cantidad_no_devuelta }"
            });
        }

        const solicitudId = parseInt(id, 10);

        await transaction.begin();
        transactionStarted = true;

        const solicitud = await new sql.Request(transaction)
            .input('id', sql.Int, solicitudId)
            .query(`
                SELECT estado
                FROM SolicitudesEstudiantes WITH (UPDLOCK, ROWLOCK)
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
                SELECT 
                    d.id_insumo, 
                    d.cantidad_solicitada AS cantidad_total, 
                    i.nombre
                FROM DetalleSolicitudEstudiante d
                JOIN Insumos i ON d.id_insumo = i.id_insumo
                WHERE d.id_solicitud = @id
            `);

        const fechaDevolucion = new Date();
        const noDevueltosValidos = [];
        const erroresValidacion = [];

        for (const detalle of detalles.recordset) {
            const noDevuelto = insumos_no_devueltos.find(i => i.id_insumo === detalle.id_insumo);
            const cantidadNoDevuelta = noDevuelto?.cantidad_no_devuelta || 0;

            if (cantidadNoDevuelta < 0 || cantidadNoDevuelta > detalle.cantidad_total) {
                erroresValidacion.push({
                    id_insumo: detalle.id_insumo,
                    nombre: detalle.nombre,
                    error: `Cantidad no devuelta inválida (0 - ${detalle.cantidad_total})`,
                    cantidad_proporcionada: cantidadNoDevuelta
                });
                continue;
            }

            const cantidadDevuelta = detalle.cantidad_total - cantidadNoDevuelta;

            if (cantidadDevuelta > 0) {
                await new sql.Request(transaction)
                    .input('id_insumo', sql.Int, detalle.id_insumo)
                    .input('cantidad', sql.Int, cantidadDevuelta)
                    .query(`
                        UPDATE Insumos 
                        SET stock_actual = stock_actual + @cantidad 
                        WHERE id_insumo = @id_insumo
                    `);

                await new sql.Request(transaction)
                    .input('id_insumo', sql.Int, detalle.id_insumo)
                    .input('cantidad', sql.Int, cantidadDevuelta)
                    .input('id_solicitud_estudiante', sql.Int, solicitudId)
                    .input('responsable', sql.VarChar(100), 'Encargado Laboratorio')
                    .input('fecha_devuelto', sql.DateTime, fechaDevolucion)
                    .query(`
                        INSERT INTO MovimientosInventario (
                            id_insumo,
                            tipo_movimiento,
                            cantidad,
                            responsable,
                            id_solicitud_estudiante,
                            fecha_devuelto
                        ) VALUES (
                            @id_insumo,
                            'DEVOLUCION_EST',
                            @cantidad,
                            @responsable,
                            @id_solicitud_estudiante,
                            @fecha_devuelto
                        )
                    `);
            }

            if (cantidadNoDevuelta > 0) {
                noDevueltosValidos.push({
                    id_insumo: detalle.id_insumo,
                    cantidad_no_devuelta: cantidadNoDevuelta,
                    nombre: detalle.nombre
                });

                await new sql.Request(transaction)
                    .input('id_insumo', sql.Int, detalle.id_insumo)
                    .input('cantidad', sql.Int, cantidadNoDevuelta)
                    .input('id_solicitud_estudiante', sql.Int, solicitudId)
                    .input('responsable', sql.VarChar(100), 'Encargado Laboratorio')
                    .query(`
                        INSERT INTO MovimientosInventario (
                            id_insumo,
                            tipo_movimiento,
                            cantidad,
                            responsable,
                            id_solicitud_estudiante
                        ) VALUES (
                            @id_insumo,
                            'NO_DEVUELTO_EST',
                            @cantidad,
                            @responsable,
                            @id_solicitud_estudiante
                        )
                    `);
            }
        }

        if (erroresValidacion.length > 0) {
            await transaction.rollback();
            return res.status(400).json({
                message: "Errores en los datos de insumos no devueltos",
                errores: erroresValidacion
            });
        }

        await new sql.Request(transaction)
            .input('id', sql.Int, solicitudId)
            .input('insumos_no_devueltos', sql.NVarChar(sql.MAX), JSON.stringify(noDevueltosValidos))
            .query(`
                UPDATE SolicitudesEstudiantes
                SET
                    estado = 'Completada',
                    insumos_no_devueltos = @insumos_no_devueltos
                WHERE id_solicitud = @id
            `);

        await transaction.commit();

        res.json({
            message: "Devolución registrada exitosamente",
            fecha_devolucion: fechaDevolucion.toISOString(),
            insumos_devueltos: detalles.recordset.length - noDevueltosValidos.length,
            insumos_no_devueltos: noDevueltosValidos
        });

    } catch (error) {
        if (transactionStarted) await transaction.rollback();
        console.error('Error al registrar devolución estudiantil:', error);
        res.status(500).json({
            message: "Error en el proceso de devolución",
            details: error.message,
            operation: "DEVOLUCION_SOLICITUD_ESTUDIANTE"
        });
    }
};

export const agregarInsumosSolicitudEstudiante = async (req, res) => {
    let transaction;
    try {
        const { id } = req.params;
        const { nuevos_insumos } = req.body;
        const solicitudId = parseInt(id, 10);

        if (!nuevos_insumos || !Array.isArray(nuevos_insumos) || nuevos_insumos.length === 0) {
            return res.status(400).json({
                message: "Se requiere un array de 'nuevos_insumos' con al menos un elemento"
            });
        }

        const pool = await getConnection();
        transaction = new sql.Transaction(pool);
        await transaction.begin();

        const solicitud = await new sql.Request(transaction)
            .input('id', sql.Int, solicitudId)
            .query('SELECT estado FROM SolicitudesEstudiantes WHERE id_solicitud = @id');

        if (!solicitud.recordset.length) {
            await transaction.rollback();
            return res.status(404).json({ message: "Solicitud no encontrada" });
        }

        const estadoActual = solicitud.recordset[0].estado;
        const estadosBloqueados = ['Completada', 'Rechazada'];

        if (estadosBloqueados.includes(estadoActual)) {
            await transaction.rollback();
            return res.status(400).json({
                message: "No se pueden agregar insumos a solicitudes completadas o rechazadas",
                estado_actual: estadoActual
            });
        }

        for (const insumo of nuevos_insumos) {
            if (!insumo.id_insumo || !insumo.cantidad_solicitada) {
                await transaction.rollback();
                return res.status(400).json({
                    message: "Cada insumo debe tener 'id_insumo' y 'cantidad_solicitada'"
                });
            }

            const insumoExists = await new sql.Request(transaction)
                .input('id_insumo', sql.Int, insumo.id_insumo)
                .query('SELECT stock_actual FROM Insumos WHERE id_insumo = @id_insumo');

            if (!insumoExists.recordset.length) {
                await transaction.rollback();
                return res.status(404).json({
                    message: `Insumo ${insumo.id_insumo} no encontrado`
                });
            }

            if (estadoActual === 'Aprobada') {
                const stockActual = insumoExists.recordset[0].stock_actual;
                if (stockActual < insumo.cantidad_solicitada) {
                    await transaction.rollback();
                    return res.status(400).json({
                        message: "Stock insuficiente para insumo",
                        id_insumo: insumo.id_insumo,
                        stock_disponible: stockActual,
                        cantidad_solicitada: insumo.cantidad_solicitada
                    });
                }

                await new sql.Request(transaction)
                    .input('id_insumo', sql.Int, insumo.id_insumo)
                    .input('cantidad', sql.Int, insumo.cantidad_solicitada)
                    .query(`
                        UPDATE Insumos 
                        SET stock_actual = stock_actual - @cantidad 
                        WHERE id_insumo = @id_insumo
                    `);

                await new sql.Request(transaction)
                    .input('id_insumo', sql.Int, insumo.id_insumo)
                    .input('cantidad', sql.Int, insumo.cantidad_solicitada)
                    .input('id_solicitud_estudiante', sql.Int, solicitudId)
                    .input('responsable', sql.VarChar(100), 'Sistema')
                    .query(`
                        INSERT INTO MovimientosInventario (
                            id_insumo, tipo_movimiento, cantidad,
                            responsable, id_solicitud_estudiante
                        ) VALUES (
                            @id_insumo, 'PRESTAMO_EST', @cantidad,
                            @responsable, @id_solicitud_estudiante
                        )
                    `);
            }

            await new sql.Request(transaction)
                .input('id_solicitud', sql.Int, solicitudId)
                .input('id_insumo', sql.Int, insumo.id_insumo)
                .input('cantidad_solicitada', sql.Int, insumo.cantidad_solicitada)
                .query(`
                    INSERT INTO DetalleSolicitudEstudiante
                        (id_solicitud, id_insumo, cantidad_solicitada)
                    VALUES (@id_solicitud, @id_insumo, @cantidad_solicitada)
                `);
        }

        await transaction.commit();

        res.json({
            message: "Insumos agregados exitosamente",
            cantidad_agregada: nuevos_insumos.length,
            estado_solicitud: estadoActual
        });

    } catch (error) {
        if (transaction) await transaction.rollback();
        console.error('Error al agregar insumos:', error);

        res.status(500).json({
            message: "Error interno al agregar insumos",
            error: error.message,
            operation: "AGREGAR_INSUMOS_SOLICITUD_ESTUDIANTE"
        });
    }
};