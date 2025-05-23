import express from 'express';
import {
    createDocente,
    getDocentes,
    getDocenteById,
    updateDocente,
    deleteDocente,
    createEstudiante,
    getAllUsers
} from '../controllers/Usuarios.controllers.js';

const router = express.Router();

router.get('/usuarios', getAllUsers);


export default router;