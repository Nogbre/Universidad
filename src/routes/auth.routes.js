import express from 'express';
import {loginDocente, loginEncargado, loginEstudiante} from '../controllers/authController.js';
const router = express.Router();

router.post('/login', loginDocente);
router.post('/encargado-login', loginEncargado);
router.post('/login-estudiante', loginEstudiante);

export default router;
