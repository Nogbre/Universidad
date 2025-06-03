import sql from 'mssql';
import { getConnection } from '../database/connection.js';

/* ───────────────────── Helpers ───────────────────── */

/** Convierte 18.2 → 18.20 (para que el total siempre tenga 2 decimales). */
const money = (n) => Number.parseFloat(n).toFixed(2);

/** Calcula monto total de los ítems. */
const calcTotal = (items = []) =>
    items.reduce((sum, it) => sum + (+it.cantidad * +it.precio_unitario), 0);

/* ───────────────────── 1. Crear ─────────────────────
 * Espera body:
 * {
 *   id_encargado, fecha_emision (yyyy-mm-dd), unidad_solicitante,
 *   centro_costo, responsable, codigo_inversion, justificacion,
 *   observaciones, items:[
 *     { cantidad, unidad, descripcion, precio_unitario }
 *   ]
 * }
 */
export const createSolicitudAdq = async (req, res) => {
  const {
    id_encargado,
    fecha_emision,
    unidad_solicitante,
    centro_costo,
    responsable,
    codigo_inversion,
    justificacion,
    observaciones,
    items = []
  } = req.body;

  if (!id_encargado || !fecha_emision || !unidad_solicitante || !responsable || !justificacion)
    return res.status(400).json({ message: 'Campos obligatorios faltantes' });

  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ message: 'La solicitud debe tener al menos un ítem' });

  const monto_total   = calcTotal(items);
  const monto_letras  = '—';                 // si quieres, convierte a letras aquí
  const estadoInicial = 'Pendiente';

  const pool = await getConnection();
  const trx  = new sql.Transaction(pool);

  try {
    await trx.begin();

    /* 1. Insertar cabecera */
    const cab = await trx.request()
        .input('id_encargado',     sql.Int,         id_encargado)
        .input('fecha',            sql.Date,        fecha_emision)
        .input('unidad',           sql.VarChar(100),unidad_solicitante)
        .input('centro',           sql.VarChar(100),centro_costo ?? null)
        .input('responsable',      sql.VarChar(100),responsable)
        .input('codigo',           sql.VarChar(50), codigo_inversion ?? null)
        .input('justificacion',    sql.Text,        justificacion)
        .input('obs',              sql.Text,        observaciones ?? null)
        .input('monto',            sql.Decimal(18,2),money(monto_total))
        .input('letras',           sql.VarChar(255),monto_letras)
        .input('estado',           sql.VarChar(30), estadoInicial)
        .query(`
        INSERT INTO SolicitudesAdquisicion
          (id_encargado, fecha_emision, unidad_solicitante, centro_costo,
           responsable, codigo_inversion, justificacion, observaciones,
           monto_total, monto_letras, estado)
        VALUES
          (@id_encargado, @fecha, @unidad, @centro,
           @responsable, @codigo, @justificacion, @obs,
           @monto, @letras, @estado);
        SELECT SCOPE_IDENTITY() AS id_solicitud;
      `);

    const id_solicitud = cab.recordset[0].id_solicitud;

    /* 2. Insertar detalle */
    const detailRequest = trx.request()
        .input('id_solicitud', sql.Int, id_solicitud);

    // build VALUES list
    const values = items.map((it, idx) => `
      (@id_solicitud, @c${idx}, @u${idx}, @d${idx}, @p${idx}, @t${idx})
    `).join(',');

    items.forEach((it, idx) => {
      detailRequest
          .input(`c${idx}`, sql.Int,          it.cantidad)
          .input(`u${idx}`, sql.VarChar(50),  it.unidad)
          .input(`d${idx}`, sql.VarChar(sql.MAX), it.descripcion)
          .input(`p${idx}`, sql.Decimal(18,2), money(it.precio_unitario))
          .input(`t${idx}`, sql.Decimal(18,2), money(it.cantidad * it.precio_unitario));
    });

    await detailRequest.query(`
      INSERT INTO DetalleSolicitudAdquisicion
        (id_solicitud, cantidad, unidad, descripcion, precio_unitario, total_item)
      VALUES ${values};
    `);

    await trx.commit();
    res.status(201).json({ id_solicitud, estado: estadoInicial });

  } catch (err) {
    await trx.rollback();
    console.error('Error create:', err);
    res.status(500).json({ message: 'Error al registrar solicitud' });
  }
};

/* ───────────────────── 2. Listar ───────────────────── */
export const getSolicitudesAdq = async (_req, res) => {
  try {
    const pool = await getConnection();
    const rs   = await pool.request().query(`
      SELECT sa.id_solicitud, sa.fecha_emision, sa.unidad_solicitante,
             sa.responsable, sa.monto_total, sa.estado
      FROM   SolicitudesAdquisicion sa
      ORDER  BY sa.id_solicitud DESC;
    `);
    res.json(rs.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al obtener solicitudes' });
  }
};

/* ───────────────────── 3. Obtener una ───────────────────── */
export const getSolicitudAdq = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await getConnection();

    const cab = await pool.request()
        .input('id', sql.Int, id)
        .query('SELECT * FROM SolicitudesAdquisicion WHERE id_solicitud = @id;');

    if (!cab.recordset.length)
      return res.status(404).json({ message: 'Solicitud no encontrada' });

    const items = await pool.request()
        .input('id', sql.Int, id)
        .query(`
        SELECT cantidad, unidad, descripcion, precio_unitario, total_item
        FROM   DetalleSolicitudAdquisicion
        WHERE  id_solicitud = @id
        ORDER  BY id_detalle;
      `);

    res.json({ ...cab.recordset[0], items: items.recordset });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al obtener la solicitud' });
  }
};

/* ───────────────────── 4. Actualizar ─────────────────────
 * – Puede actualizar cabecera y, opcionalmente, reemplazar los items
 * – Si viene "items", los detalla se sobre-escriben por completo
 */
export const updateSolicitudAdq = async (req, res) => {
  const { id } = req.params;
  const {
    fecha_emision,
    unidad_solicitante,
    centro_costo,
    responsable,
    codigo_inversion,
    justificacion,
    observaciones,
    estado,
    items
  } = req.body;

  if (isNaN(id)) return res.status(400).json({ message: 'ID inválido' });

  const pool = await getConnection();
  const trx  = new sql.Transaction(pool);

  try {
    await trx.begin();

    /* 1. Verificar existencia */
    const exists = await trx.request()
        .input('id', sql.Int, id)
        .query('SELECT 1 FROM SolicitudesAdquisicion WHERE id_solicitud = @id;');

    if (!exists.recordset.length) {
      await trx.rollback();
      return res.status(404).json({ message: 'Solicitud no encontrada' });
    }

    const sets = [];
    const req  = trx.request().input('id', sql.Int, id);

    const add = (col, val, type) => {
      if (val !== undefined) {
        req.input(col, type, val);
        sets.push(`${col} = @${col}`);
      }
    };

    add('fecha_emision',      fecha_emision,      sql.Date);
    add('unidad_solicitante', unidad_solicitante, sql.VarChar(100));
    add('centro_costo',       centro_costo,       sql.VarChar(100));
    add('responsable',        responsable,        sql.VarChar(100));
    add('codigo_inversion',   codigo_inversion,   sql.VarChar(50));
    add('justificacion',      justificacion,      sql.Text);
    add('observaciones',      observaciones,      sql.Text);
    add('estado',             estado,             sql.VarChar(30));

    if (sets.length)
      await req.query(`UPDATE SolicitudesAdquisicion SET ${sets.join(', ')} WHERE id_solicitud = @id;`);

    if (Array.isArray(items)) {
      await trx.request()
          .input('id', sql.Int, id)
          .query('DELETE FROM DetalleSolicitudAdquisicion WHERE id_solicitud = @id;');

      if (items.length) {
        const dReq = trx.request().input('id_solicitud', sql.Int, id);
        const values = items.map((it, idx) => `
          (@id_solicitud, @c${idx}, @u${idx}, @d${idx}, @p${idx}, @t${idx})
        `).join(',');

        items.forEach((it, idx) => {
          dReq
              .input(`c${idx}`, sql.Int, it.cantidad)
              .input(`u${idx}`, sql.VarChar(50), it.unidad)
              .input(`d${idx}`, sql.VarChar(sql.MAX), it.descripcion)
              .input(`p${idx}`, sql.Decimal(18,2), money(it.precio_unitario))
              .input(`t${idx}`, sql.Decimal(18,2), money(it.cantidad * it.precio_unitario));
        });

        await dReq.query(`
          INSERT INTO DetalleSolicitudAdquisicion
            (id_solicitud, cantidad, unidad, descripcion, precio_unitario, total_item)
          VALUES ${values};
        `);

        const newTotal = calcTotal(items);
        await trx.request()
            .input('id', sql.Int, id)
            .input('monto', sql.Decimal(18,2), money(newTotal))
            .query('UPDATE SolicitudesAdquisicion SET monto_total = @monto WHERE id_solicitud = @id;');
      }
    }

    await trx.commit();
    res.json({ message: 'Solicitud actualizada' });

  } catch (err) {
    await trx.rollback();
    console.error(err);
    res.status(500).json({ message: 'Error al actualizar' });
  }
};

/* ───────────────────── 5. Eliminar ───────────────────── */
export const deleteSolicitudAdq = async (req, res) => {
  const { id } = req.params;
  if (isNaN(id)) return res.status(400).json({ message: 'ID inválido' });

  try {
    const pool = await getConnection();
    const rs   = await pool.request()
        .input('id', sql.Int, id)
        .query('DELETE FROM SolicitudesAdquisicion WHERE id_solicitud = @id;');

    if (rs.rowsAffected[0] === 0)
      return res.status(404).json({ message: 'Solicitud no encontrada' });

    res.json({ message: 'Solicitud borrada' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al eliminar solicitud' });
  }
};
