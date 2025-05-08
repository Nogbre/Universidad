import { getConnection } from "../database/connection.js";
import sql from 'mssql';
import bcrypt from 'bcryptjs';

export const loginDocente = async (req, res) => {
    try {
        const { correo, contrasena } = req.body;

        if (!correo || !contrasena) {
            return res.status(400).json({ message: "Correo y contraseña son obligatorios" });
        }

        const pool = await getConnection();
        const result = await pool.request()
            .input("correo", sql.VarChar(100), correo)
            .query("SELECT * FROM Docentes WHERE correo = @correo");

        if (result.recordset.length === 0) {
            return res.status(401).json({ message: "Correo o contraseña incorrectos" });
        }

        const docente = result.recordset[0];
        const passwordMatch = await bcrypt.compare(contrasena, docente.contrasena);

        if (!passwordMatch) {
            return res.status(401).json({ message: "Correo o contraseña incorrectos" });
        }

        res.json({
            id_docente: docente.id_docente,
            nombre: docente.nombre,
            apellido: docente.apellido,
            correo: docente.correo
        });

    } catch (error) {
        console.error("Error en login:", error);
        res.status(500).json({ message: "Error al iniciar sesión" });
    }
};

export const loginEncargado = async (req, res) => {
    try {
        const { correo, contrasena } = req.body;

        if (!correo || !contrasena) {
            return res.status(400).json({ message: "Correo y contraseña son obligatorios" });
        }

        const pool = await getConnection();
        const result = await pool.request()
            .input("correo", sql.VarChar(100), correo)
            .query("SELECT * FROM EncargadoLaboratorio WHERE correo = @correo");

        if (result.recordset.length === 0) {
            return res.status(401).json({ message: "Correo o contraseña incorrectos" });
        }

        const encargado = result.recordset[0];
        const passwordMatch = await bcrypt.compare(contrasena, encargado.contrasena);

        if (!passwordMatch) {
            return res.status(401).json({ message: "Correo o contraseña incorrectos" });
        }

        res.json({
            id_encargado: encargado.id_encargado,
            nombre: encargado.nombre,
            apellido: encargado.apellido,
            correo: encargado.correo
        });

    } catch (error) {
        console.error("Error en login encargado:", error);
        res.status(500).json({ message: "Error al iniciar sesión" });
    }
};
