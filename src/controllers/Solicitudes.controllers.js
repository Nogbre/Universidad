// src/controllers/Solicitudes.controller.js
import sql               from 'mssql';
import { getConnection } from '../database/connection.js';

/* ───────────── Helpers ───────────── */

const toMoney = (n) => Number.parseFloat(n.toFixed(2));

/**
 * Convierte un número (0 – 999 999 999) a letras en español (forma compacta).
 * Ej. 38 510  →  "TREINTA Y OCHO MIL QUINIENTOS DIEZ 00/100 BOLIVIANOS"
 */
function numeroALetras(num = 0) {
  const unidades = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco',
    'seis', 'siete', 'ocho', 'nueve'];
  const especiales = {
    10: 'diez', 11: 'once', 12: 'doce', 13: 'trece', 14: 'catorce', 15: 'quince'
  };
  const decenasTxt = ['', 'diez', 'veinte', 'treinta', 'cuarenta', 'cincuenta',
    'sesenta', 'setenta', 'ochenta', 'noventa'];
  const centenasTxt = ['', 'cien', 'doscientos', 'trescientos', 'cuatrocientos',
    'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

  /* convierte 0-999 → texto */
  const tramo999 = (n) => {
    if (n === 0) return '';
    if (n in especiales) return especiales[n];
    let txt = '';
    if (n >= 100) {
      const c = Math.trunc(n / 100);
      txt += (c === 1 && n % 100 ? 'ciento' : centenasTxt[c]) + ' ';
      n %= 100;
    }
    if (n >= 20) {
      txt += decenasTxt[Math.trunc(n / 10)];
      n %= 10;
      if (n) txt += ` y ${unidades[n]}`;
    } else if (n >= 16) {
      txt += `dieci${unidades[n - 10]}`;
      n = 0;
    } else if (n >= 10) {
      txt += especiales[n];
      n = 0;
    }
    if (n && n < 10) txt += (txt ? ' ' : '') + unidades[n];
    return txt.trim();
  };

  const entero = Math.trunc(num);
  if (entero === 0) return 'CERO 00/100 BOLIVIANOS';

  const millones  = Math.trunc(entero / 1_000_000);
  const milesRest = entero % 1_000_000;
  const miles     = Math.trunc(milesRest / 1_000);
  const cientos   = milesRest % 1_000;

  let texto = '';
  if (millones)  texto += `${tramo999(millones)} millón${millones > 1 ? 'es' : ''} `;
  if (miles)     texto += `${tramo999(miles)} mil `;
  if (cientos)   texto += tramo999(cientos);

  const centavos = num.toFixed(2).split('.')[1];
  return `${texto.trim().toUpperCase()} ${centavos}/100 BOLIVIANOS`;
}

/* ───────────── CREATE ───────────── */
export const createSolicitud = async (req, res) => {
  const {
    id_encargado,
    fecha_emision,
    centro_costo     = null,
    codigo_inversion = null,
    justificacion,
    observaciones    = '',
    items            = []            // [{ id_insumo, cantidad, precio_unitario, descripcion }]
  } = req.body;

  if (!id_encargado || !fecha_emision || !justificacion)
    return res.status(400).json({ message: 'Campos obligatorios faltantes' });

  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ message: 'Debe incluir al menos un ítem' });

  const pool = await getConnection();
  const tx   = new sql.Transaction(pool);

  try {
    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    /* 1. Encargado → responsable + unidad solicitante */
    const enc = await new sql.Request(tx)
        .input('id', sql.Int, id_encargado)
        .query(`SELECT nombre, apellido, unidad_solicitante
                FROM EncargadoLaboratorio
                WHERE id_encargado = @id`);

    if (!enc.recordset.length)
      throw new Error(`Encargado ID ${id_encargado} no existe`);

    const responsable        = `${enc.recordset[0].nombre} ${enc.recordset[0].apellido}`.toUpperCase();
    const unidad_solicitante = (enc.recordset[0].unidad_solicitante || '').toUpperCase();

    /* 2. Preparar detalle y monto total */
    let monto_total = 0;
    const detalle   = [];

    for (const it of items) {
      const { id_insumo, cantidad, precio_unitario, descripcion } = it;
      if (![id_insumo, cantidad, precio_unitario, descripcion].every(Boolean))
        throw new Error('Ítem con campos incompletos');

      const uni = await new sql.Request(tx)
          .input('iid', sql.Int, id_insumo)
          .query('SELECT unidad_medida FROM Insumos WHERE id_insumo = @iid');

      if (!uni.recordset.length)
        throw new Error(`Insumo ID ${id_insumo} no existe`);

      const unidad     = uni.recordset[0].unidad_medida || '-';
      const total_item = toMoney(cantidad * precio_unitario);
      monto_total     += total_item;

      detalle.push({ id_insumo, cantidad, unidad, descripcion, precio_unitario, total_item });
    }

    monto_total = toMoney(monto_total);
    const letras = numeroALetras(monto_total);

    /* 3. Insertar cabecera */
    const cab = await new sql.Request(tx)
        .input('enc',    sql.Int,          id_encargado)
        .input('fem',    sql.Date,         fecha_emision)
        .input('uni',    sql.VarChar(100), unidad_solicitante)
        .input('cc',     sql.VarChar(100), centro_costo)
        .input('resp',   sql.VarChar(100), responsable)
        .input('codInv', sql.VarChar(50),  codigo_inversion)
        .input('just',   sql.Text,         justificacion)
        .input('obs',    sql.Text,         observaciones)
        .input('tot',    sql.Decimal(18,2),monto_total)
        .input('let',    sql.VarChar(255), letras)
        .query(`
          INSERT INTO SolicitudesAdquisicion
          (id_encargado, fecha_emision, unidad_solicitante, centro_costo,
           responsable,  codigo_inversion, justificacion, observaciones,
           monto_total,  monto_letras, estado)
          VALUES
            (@enc, @fem, @uni, @cc,
             @resp, @codInv, @just, @obs,
             @tot, @let, 'Pendiente');
          SELECT SCOPE_IDENTITY() AS id;`);

    const id_solicitud = cab.recordset[0].id;

    /* 4. Insertar detalle */
    for (const d of detalle) {
      await new sql.Request(tx)
          .input('idSol', sql.Int,            id_solicitud)
          .input('iid',   sql.Int,            d.id_insumo)
          .input('cant',  sql.Int,            d.cantidad)
          .input('uni',   sql.VarChar(50),    d.unidad)
          .input('desc',  sql.Text,           d.descripcion)
          .input('pu',    sql.Decimal(18, 2), d.precio_unitario)
          .input('tot',   sql.Decimal(18, 2), d.total_item)
          .query(`
            INSERT INTO DetalleSolicitudAdquisicion
            (id_solicitud, id_insumo, cantidad, unidad,
             descripcion, precio_unitario, total_item)
            VALUES (@idSol, @iid, @cant, @uni,
                    @desc,  @pu,  @tot);`);
    }

    await tx.commit();
    res.status(201).json({ id_solicitud, estado: 'Pendiente' });

  } catch (err) {
    await tx.rollback();
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

/* ───────────── LISTAR & DETALLE ───────────── */
export const getSolicitudes = async (_req, res) => {
  try {
    const pool = await getConnection();
    const { recordset } = await pool.request().query(`
      SELECT id_solicitud, fecha_emision, unidad_solicitante,
             responsable, monto_total, estado
      FROM   SolicitudesAdquisicion
      ORDER  BY id_solicitud DESC;`);
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

    const cab = await pool.request()
        .input('id', sql.Int, id)
        .query('SELECT * FROM SolicitudesAdquisicion WHERE id_solicitud = @id');

    if (!cab.recordset.length)
      return res.status(404).json({ message: 'Solicitud no encontrada' });

    const det = await pool.request()
        .input('id', sql.Int, id)
        .query(`
          SELECT d.*, i.nombre AS nombre_insumo
          FROM   DetalleSolicitudAdquisicion d
                   JOIN Insumos i ON i.id_insumo = d.id_insumo
          WHERE  d.id_solicitud = @id
          ORDER  BY d.id_detalle;`);

    res.json({ ...cab.recordset[0], items: det.recordset });

  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Error al obtener solicitud' });
  }
};

/* ───────────── UPDATE ───────────── */
export const updateSolicitud = async (req, res) => {
  const { id } = req.params;
  const { estado, observaciones, items } = req.body;

  const pool = await getConnection();
  const tx   = new sql.Transaction(pool);

  try {
    await tx.begin();

    const ex = await new sql.Request(tx)
        .input('id', sql.Int, id)
        .query('SELECT 1 FROM SolicitudesAdquisicion WHERE id_solicitud = @id');
    if (!ex.recordset.length)
      throw new Error('Solicitud no existe');

    /* 1. cabecera */
    await new sql.Request(tx)
        .input('id',  sql.Int, id)
        .input('est', sql.VarChar(30), estado || null)
        .input('obs', sql.Text,        observaciones || null)
        .query(`
          UPDATE SolicitudesAdquisicion
          SET estado       = ISNULL(@est, estado),
              observaciones= ISNULL(@obs, observaciones)
          WHERE id_solicitud = @id;`);

    /* 2. detalle (si llega) */
    if (Array.isArray(items)) {
      await new sql.Request(tx)
          .input('id', sql.Int, id)
          .query('DELETE FROM DetalleSolicitudAdquisicion WHERE id_solicitud = @id');

      let total = 0;

      for (const it of items) {
        const { id_insumo, cantidad, precio_unitario, descripcion } = it;

        const uni = await new sql.Request(tx)
            .input('iid', sql.Int, id_insumo)
            .query('SELECT unidad_medida FROM Insumos WHERE id_insumo = @iid');
        if (!uni.recordset.length)
          throw new Error(`Insumo ID ${id_insumo} no existe`);

        const unidad   = uni.recordset[0].unidad_medida || '-';
        const totItem  = toMoney(cantidad * precio_unitario);
        total         += totItem;

        await new sql.Request(tx)
            .input('idSol', sql.Int,           id)
            .input('iid',   sql.Int,           id_insumo)
            .input('cant',  sql.Int,           cantidad)
            .input('uni',   sql.VarChar(50),   unidad)
            .input('desc',  sql.Text,          descripcion)
            .input('pu',    sql.Decimal(18,2), precio_unitario)
            .input('tot',   sql.Decimal(18,2), totItem)
            .query(`
              INSERT INTO DetalleSolicitudAdquisicion
              (id_solicitud, id_insumo, cantidad, unidad,
               descripcion, precio_unitario, total_item)
              VALUES
                (@idSol, @iid, @cant, @uni,
                 @desc,  @pu,  @tot);`);
      }

      total = toMoney(total);
      const letras = numeroALetras(total);

      await new sql.Request(tx)
          .input('id',  sql.Int, id)
          .input('tot', sql.Decimal(18,2), total)
          .input('let', sql.VarChar(255),  letras)
          .query(`
            UPDATE SolicitudesAdquisicion
            SET monto_total = @tot,
                monto_letras= @let
            WHERE id_solicitud = @id;`);
    }

    await tx.commit();
    res.json({ message: 'Solicitud actualizada' });

  } catch (e) {
    await tx.rollback();
    console.error(e);
    res.status(500).json({ message: e.message });
  }
};

/* ───────────── DELETE ───────────── */
export const deleteSolicitud = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await getConnection();
    const { rowsAffected } = await pool.request()
        .input('id', sql.Int, id)
        .query('DELETE FROM SolicitudesAdquisicion WHERE id_solicitud = @id');

    if (!rowsAffected[0])
      return res.status(404).json({ message: 'Solicitud no encontrada' });

    res.json({ message: 'Solicitud eliminada' });

  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Error al eliminar solicitud' });
  }
};
