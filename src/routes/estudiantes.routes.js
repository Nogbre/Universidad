import { Router } from 'express';
import {
    agregarInsumosSolicitudEstudiante,
    createEstudiante,
    createSolicitudEstudiante, devolverSolicitudEstudiante, getInsumosPrestadosEstudiante,
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
router.patch('/estudiantes/solicitudes/:id', updateEstadoSolicitudEstudiante);
router.patch('/estudiantes/solicitudes/:id/agregar-insumos', agregarInsumosSolicitudEstudiante);
router.patch('/estudiantes/solicitudes/:id/devolver', devolverSolicitudEstudiante);
router.get('/estudiantes/:id/insumos-prestados', getInsumosPrestadosEstudiante);

export default router;