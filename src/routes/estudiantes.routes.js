import { Router } from 'express';
import {
    createEstudiante,
    createSolicitudEstudiante,
    getSolicitudesEstudiante,
    getSolicitudEstudianteById, updateEstadoSolicitudEstudiante
} from '../controllers/estudiantes.controller.js';

const router = Router();

// Registro de estudiante
router.post('/estudiantes', createEstudiante);

// Solicitudes de uso
router.post('/estudiantes/solicitudes', createSolicitudEstudiante);
router.get('/estudiantes/solicitudes', getSolicitudesEstudiante);
router.get('/estudiantes/solicitudes/:id', getSolicitudEstudianteById);
router.patch('/solicitudes/:id', updateEstadoSolicitudEstudiante);

export default router;