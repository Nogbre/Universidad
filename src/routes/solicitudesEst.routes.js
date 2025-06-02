// src/routes/solicitudesEst.routes.js
import { Router } from 'express';
import {
    generarExcelSolicitudEstudiante,
} from '../controllers/generarExcelSolicitudEstudiante.controller.js';

const router = Router();

router.get('/excel/solicitudes-estudiantes/:id/excel', generarExcelSolicitudEstudiante);


export default router;
