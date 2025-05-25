import { getConnection } from "../database/connection.js";
import sql from 'mssql';
import bcrypt from 'bcryptjs';


const saltRounds = 10;

export const createDocente = async (req, res) => {
    try {
        const { nombre, apellido, correo, contrasena, id_carrera } = req.body;

        if (!nombre || !apellido || !correo || !contrasena) {
            return res.status(400).json({ message: "Faltan campos obligatorios" });
        }

        const hashedPassword = await bcrypt.hash(contrasena, saltRounds);

        const pool = await getConnection();
        const result = await pool.request()
            .input('nombre', sql.VarChar(100), nombre)
            .input('apellido', sql.VarChar(100), apellido)
            .input('correo', sql.VarChar(100), correo)
            .input('contrasena', sql.VarChar(100), hashedPassword)
            .input('id_carrera', sql.Int, id_carrera)
            .query(`
                INSERT INTO Docentes (nombre, apellido, correo, contrasena, id_carrera)
                OUTPUT INSERTED.id_docente
                VALUES (@nombre, @apellido, @correo, @contrasena, @id_carrera)
            `);

        res.status(201).json({
            id_docente: result.recordset[0].id_docente,
            message: "Docente creado exitosamente"
        });

    } catch (error) {
        if (error.number === 2627) {
            return res.status(409).json({ message: "El correo ya está registrado" });
        }
        console.error('Error al crear docente:', error);
        res.status(500).json({ message: "Error al crear docente" });
    }
};

export const getDocentes = async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .query(`
                SELECT d.id_docente, d.nombre, d.apellido, d.correo, d.id_carrera, da.id_aula
                FROM Docentes d
                LEFT JOIN DocenteAula da ON d.id_docente = da.id_docente
            `);

        res.json(result.recordset);
    } catch (error) {
        console.error('Error al obtener docentes:', error);
        res.status(500).json({ message: "Error al obtener docentes" });
    }
};

export const getDocenteById = async (req, res) => {
    try {
        const { id } = req.params;

        const pool = await getConnection();
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query(`
                SELECT id_docente, nombre, apellido, correo, id_carrera 
                FROM Docentes 
                WHERE id_docente = @id
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ message: "Docente no encontrado" });
        }

        res.json(result.recordset[0]);
    } catch (error) {
        console.error('Error al obtener docente:', error);
        res.status(500).json({ message: "Error al obtener docente" });
    }
};

export const updateDocente = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, apellido, correo, contrasena, id_carrera } = req.body;

        const pool = await getConnection();
        let hashedPassword;
        let updateFields = [];
        let inputs = [];

        if (nombre) {
            updateFields.push('nombre = @nombre');
            inputs.push({ name: 'nombre', type: sql.VarChar(100), value: nombre });
        }
        if (apellido) {
            updateFields.push('apellido = @apellido');
            inputs.push({ name: 'apellido', type: sql.VarChar(100), value: apellido });
        }
        if (correo) {
            updateFields.push('correo = @correo');
            inputs.push({ name: 'correo', type: sql.VarChar(100), value: correo });
        }
        if (contrasena) {
            hashedPassword = await bcrypt.hash(contrasena, saltRounds);
            updateFields.push('contrasena = @contrasena');
            inputs.push({ name: 'contrasena', type: sql.VarChar(100), value: hashedPassword });
        }
        if (id_carrera) {
            updateFields.push('id_carrera = @id_carrera');
            inputs.push({ name: 'id_carrera', type: sql.Int, value: id_carrera });
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ message: "No se proporcionaron datos para actualizar" });
        }

        const request = pool.request();
        inputs.forEach(input => request.input(input.name, input.type, input.value));
        request.input('id', sql.Int, id);

        const query = `
            UPDATE Docentes 
            SET ${updateFields.join(', ')}
            WHERE id_docente = @id
        `;

        const result = await request.query(query);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ message: "Docente no encontrado" });
        }

        res.json({ message: "Docente actualizado exitosamente" });

    } catch (error) {
        console.error('Error al actualizar docente:', error);
        res.status(500).json({ message: "Error al actualizar docente" });
    }
};

export const deleteDocente = async (req, res) => {
    try {
        const { id } = req.params;

        const pool = await getConnection();
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM Docentes WHERE id_docente = @id');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ message: "Docente no encontrado" });
        }

        res.json({ message: "Docente eliminado exitosamente" });

    } catch (error) {
        if (error.number === 547) {
            return res.status(409).json({
                message: "No se puede eliminar el docente porque tiene solicitudes asociadas"
            });
        }
        console.error('Error al eliminar docente:', error);
        res.status(500).json({ message: "Error al eliminar docente" });
    }
};

/*──────────────────────  ASIGNACIÓN / CONSULTA DE AULAS  ─────────────────────*/

/*  Insert o Update (MERGE)  */
export const asignarAulaDocente = async (req, res) => {
  try {
    const { id }      = req.params;   // id_docente
    const { id_aula } = req.body;

    if (!id_aula)
      return res.status(400).json({ message: "id_aula requerido" });

    const pool = await getConnection();

    /* verificar existencia docente y aula */
    const [[docente], [aula]] = await Promise.all([
      pool.request().input("id",     sql.Int, id)      .query("SELECT 1 FROM Docentes          WHERE id_docente = @id"),
      pool.request().input("id_aula",sql.Int, id_aula) .query("SELECT 1 FROM aulaLaboratorio   WHERE id_aula    = @id_aula")
    ]).then(resArr => resArr.map(r => r.recordset));

    if (!docente) return res.status(404).json({ message: "Docente no encontrado" });
    if (!aula)    return res.status(404).json({ message: "Aula no encontrada" });

    /* MERGE = upsert */
    await pool.request()
      .input("id_docente", sql.Int, id)
      .input("id_aula",    sql.Int, id_aula)
      .query(`
        MERGE DocenteAula AS target
        USING (SELECT @id_docente AS id_docente) AS src
             ON target.id_docente = src.id_docente
        WHEN MATCHED THEN
             UPDATE SET id_aula = @id_aula
        WHEN NOT MATCHED THEN
             INSERT (id_docente, id_aula) VALUES (@id_docente, @id_aula);
      `);

    res.json({
      message:     "Aula asignada/actualizada correctamente",
      id_docente:  Number(id),
      id_aula:     Number(id_aula)
    });

  } catch (error) {
    console.error("Error al asignar aula:", error);
    res.status(500).json({ message: "Error interno del servidor", error: error.message });
  }
};


/*  Devuelve todas las aulas asignadas a un docente  */
export const getAulasAsignadas = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getConnection();
    const result = await pool.request()
      .input("id", sql.Int, id)
      .query(`
        SELECT  a.id_aula,
                a.nombre_aula,
                e.nombre + ' ' + e.apellido AS encargado
        FROM    DocenteAula      da
        JOIN    aulaLaboratorio  a ON a.id_aula      = da.id_aula
        JOIN    EncargadoLaboratorio e ON e.id_encargado = a.encargado_id
        WHERE   da.id_docente = @id
      `);

    res.json(result.recordset);

  } catch (error) {
    console.error("Error al obtener aulas asignadas:", error);
    res.status(500).json({ message: "Error al obtener aulas asignadas" });
  }
};
