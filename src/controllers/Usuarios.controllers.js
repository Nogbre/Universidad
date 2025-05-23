import { getConnection } from '../database/connection.js';
import sql from 'mssql';

export const getAllUsersConsolidated = async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request().query('SELECT * FROM Docentes, Estudiantes, EncargadoLaboratorio');
        res.json(result.recordset);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener usuarios consolidados', error: error.message });
    }
};

