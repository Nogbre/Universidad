// src/controllers/Solicitudes.controller.js
import sql              from 'mssql';
import { getConnection } from '../database/connection.js';

/* ────────────────────────────── Helpers ────────────────────────────── */

const toMoney = (v) => Number.parseFloat(v.toFixed(2));

/**
 * Convierte un número (máx 999 999 999) a letras en español (modo resumido).
 * Devuelve EJ.: "TREINTA Y OCHO MIL QUINIENTOS DIEZ 00/100 BOLIVIANOS"
 */
function numeroALetras(num = 0) {
  const unidades = ['','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve'];
  const decenas  = ['','diez','veinte','treinta','cuarenta','cincuenta','sesenta','setenta','ochenta','noventa'];
  const centenas = ['','cien','doscientos','trescientos','cuatrocientos','quinientos','seiscientos','setecientos','ochocientos','novecientos'];

  const n = Math.trunc(num);
  if (n === 0) return 'CERO 00/100 BOLIVIANOS';

  let texto = '';
  let resto = n;

  const c = Math.trunc(resto / 1000000);        // millones
  if (c) { texto += `${unidades[c]} millones `; resto = resto % 1000000; }

  const m = Math.trunc(resto / 1000);           // millares
  if (m) { texto += `${unidades[m]} mil `; resto = resto % 1000; }

  const ce = Math.trunc(resto / 100);           // centenas
  if (ce) { texto += `${centenas[ce]} `; resto = resto % 100; }

  const de = Math.trunc(resto / 10);            // decenas
  if (de) { texto += `${decenas[de]} `; resto = resto % 10; }

  if (resto) texto += `${unidades[resto]} `;

  return `${texto.trim().toUpperCase()} ${num.toFixed(2).split('.')[1]}/100 BOLIVIANOS`;
}

/* ────────────────────────────── CREATE ────────────────────────────── */

export const createSolicitud = async (req, res) => {
  const {
    id_encargado, fecha_emision, unidad_solicitante, centro_costo,
    responsable, codigo_inversion, justificacion, observaciones = '',
    items = []
  } = req.body;

  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ message: 'Debe incluir al menos un ítem' });

  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const tRequest = new sql.Request(transaction);

    /* 1.  Calcular totales y preparar ítems con unidad */
    let monto_total = 0;
    const detalle = [];

    for (const it of items) {
      const { id_insumo, cantidad, precio_unitario, descripcion } = it;

      if (![id_insumo, cantidad, precio_unitario, descripcion].every(Boolean))
        throw new Error('Campos incompletos en algún ítem');

      // obtener unidad desde Insumos
      const { recordset } = await tRequest
          .input('id', sql.Int, id_insumo)
          .query('SELECT unidad_medida FROM Insumos WHERE id_insumo = @id');

      if (!recordset.length)
        throw new Error(`Insumo ID ${id_insumo} no existe`);

      const unidad = recordset[0].unidad_medida || '-';

      const total_item = toMoney(cantidad * precio_unitario);
      monto_total += total_item;

      detalle.push({ id_insumo, cantidad, unidad, descripcion, precio_unitario, total_item });
    }

    monto_total = toMoney(monto_total);
    const monto_letras = numeroALetras(monto_total);

    /* 2.  Insertar cabecera y obtener id_solicitud */
    const cabReq = new sql.Request(transaction);
    const cabRes = await cabReq
        .input('id_enc',          sql.Int,            id_encargado)
        .input('fecha',           sql.Date,           fecha_emision)
        .input('unidad',          sql.VarChar(100),   unidad_solicitante)
        .input('cc',              sql.VarChar(100),   centro_costo || null)
        .input('resp',            sql.VarChar(100),   responsable)
        .input('codInv',          sql.VarChar(50),    codigo_inversion || null)
        .input('just',            sql.Text,           justificacion)
        .input('obs',             sql.Text,           observaciones)
        .input('total',           sql.Decimal(18, 2), monto_total)
        .input('letras',          sql.VarChar(255),   monto_letras)
        .query(`
        INSERT INTO SolicitudesAdquisicion
          (id_encargado, fecha_emision, unidad_solicitante, centro_costo,
           responsable, codigo_inversion, justificacion, observaciones,
           monto_total, monto_letras, estado)
        VALUES
          (@id_enc, @fecha, @unidad, @cc,
           @resp,   @codInv, @just,  @obs,
           @total,  @letras, 'Pendiente');
        SELECT SCOPE_IDENTITY() AS id;
      `);

    const id_solicitud = cabRes.recordset[0].id;

    /* 3.  Insertar detalle */
    const detReq = new sql.Request(transaction);

    for (const d of detalle) {
      await detReq
          .input('id_sol', sql.Int,            id_solicitud)
          .input('cant',   sql.Int,            d.cantidad)
          .input('uni',    sql.VarChar(50),    d.unidad)
          .input('desc',   sql.Text,           d.descripcion)
          .input('pu',     sql.Decimal(18, 2), d.precio_unitario)
          .input('tot',    sql.Decimal(18, 2), d.total_item)
          .query(`
          INSERT INTO DetalleSolicitudAdquisicion
            (id_solicitud, cantidad, unidad, descripcion, precio_unitario, total_item)
          VALUES (@id_sol, @cant, @uni, @desc, @pu, @tot);
        `);
    }

    await transaction.commit();
    res.status(201).json({ id_solicitud, estado: 'Pendiente' });

  } catch (err) {
    await transaction.rollback();
    console.error('Error al crear solicitud:', err);
    res.status(500).json({ message: err.message });
  }
};

/* ────────────────────────────── READ ────────────────────────────── */

export const getSolicitudes = async (_req, res) => {
  try {
    const pool   = await getConnection();
    const { recordset } = await pool.request().query(`
      SELECT id_solicitud, fecha_emision, unidad_solicitante,
             responsable, monto_total, estado
      FROM   SolicitudesAdquisicion
      ORDER  BY id_solicitud DESC;
    `);
    res.json(recordset);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Error al obtener solicitudes' });
  }
};

export const getSolicitud = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await getConnection();

    /* Cabecera */
    const cab = await pool.request()
        .input('id', sql.Int, id)
        .query('SELECT * FROM SolicitudesAdquisicion WHERE id_solicitud = @id');

    if (!cab.recordset.length)
      return res.status(404).json({ message: 'Solicitud no encontrada' });

    /* Detalle */
    const det = await pool.request()
        .input('id', sql.Int, id)
        .query(`
          SELECT d.*, i.nombre AS nombre_insumo
          FROM   DetalleSolicitudAdquisicion d
                   JOIN   Insumos i ON i.id_insumo = d.id_insumo
          WHERE  id_solicitud = @id
          ORDER  BY id_detalle;
        `);

    res.json({ ...cab.recordset[0], items: det.recordset });

  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Error al obtener solicitud' });
  }
};

/* ────────────────────────────── UPDATE ────────────────────────────── */

export const updateSolicitud = async (req, res) => {
  const { id } = req.params;
  const { estado, observaciones, items } = req.body; // cabecera parcial + posible nuevo detalle

  const pool = await getConnection();
  const tx   = new sql.Transaction(pool);

  try {
    await tx.begin();

    /* 1. Verificar existencia */
    const { recordset } = await new sql.Request(tx)
        .input('id', sql.Int, id)
        .query('SELECT 1 FROM SolicitudesAdquisicion WHERE id_solicitud = @id');

    if (!recordset.length)
      throw new Error('Solicitud no existe');

    /* 2. Actualizar cabecera */
    await new sql.Request(tx)
        .input('id',  sql.Int, id)
        .input('est', sql.VarChar(30), estado || null)
        .input('obs', sql.Text,        observaciones || null)
        .query(`
        UPDATE SolicitudesAdquisicion
        SET  estado       = ISNULL(@est, estado),
             observaciones= ISNULL(@obs, observaciones)
        WHERE id_solicitud = @id;
      `);

    /* 3. Si llegan items, reemplazar todo el detalle */
    if (Array.isArray(items)) {
      // borrar detalle actual
      await new sql.Request(tx)
          .input('id', sql.Int, id)
          .query('DELETE FROM DetalleSolicitudAdquisicion WHERE id_solicitud = @id');

      let nuevoTotal = 0;

      for (const it of items) {
        const { id_insumo, cantidad, precio_unitario, descripcion } = it;

        const unidadRS = await new sql.Request(tx)
            .input('iid', sql.Int, id_insumo)
            .query('SELECT unidad_medida FROM Insumos WHERE id_insumo = @iid');

        if (!unidadRS.recordset.length)
          throw new Error(`Insumo ID ${id_insumo} no existe`);

        const unidad       = unidadRS.recordset[0].unidad_medida || '-';
        const total_item   = toMoney(cantidad * precio_unitario);
        nuevoTotal        += total_item;

        await new sql.Request(tx)
            .input('id_sol', sql.Int,            id)
            .input('iid',    sql.Int,            id_insumo)
            .input('cant',   sql.Int,            cantidad)
            .input('uni',    sql.VarChar(50),    unidad)
            .input('desc',   sql.Text,           descripcion)
            .input('pu',     sql.Decimal(18, 2), precio_unitario)
            .input('tot',    sql.Decimal(18, 2), total_item)
            .query(`
            INSERT INTO DetalleSolicitudAdquisicion
              (id_solicitud, id_insumo, cantidad, unidad, descripcion, precio_unitario, total_item)
            VALUES
              (@id_sol, @iid, @cant, @uni, @desc, @pu, @tot);
          `);
      }

      nuevoTotal = toMoney(nuevoTotal);
      const letras = numeroALetras(nuevoTotal);

      await new sql.Request(tx)
          .input('id',  sql.Int, id)
          .input('tot', sql.Decimal(18, 2), nuevoTotal)
          .input('let', sql.VarChar(255),   letras)
          .query(`
          UPDATE SolicitudesAdquisicion
          SET monto_total = @tot,
              monto_letras= @let
          WHERE id_solicitud = @id;
        `);
    }

    await tx.commit();
    res.json({ message: 'Solicitud actualizada' });

  } catch (e) {
    await tx.rollback();
    console.error(e);
    res.status(500).json({ message: e.message });
  }
};

/* ────────────────────────────── DELETE ────────────────────────────── */

export const deleteSolicitud = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await getConnection();
    const { rowsAffected } = await pool.request()
        .input('id', sql.Int, id)
        .query('DELETE FROM SolicitudesAdquisicion WHERE id_solicitud = @id');

    if (!rowsAffected[0])
      return res.status(404).json({ message: 'Solicitud no encontrada' });

    // detalle se borra solo por ON DELETE CASCADE
    res.json({ message: 'Solicitud eliminada' });

  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Error al eliminar solicitud' });
  }
};
