import { Router } from 'express';
import {
    createSolicitudUso,
    getSolicitudesUso,
    getSolicitudUsoById,
    updateEstadoSolicitud,
    devolverSolicitud,
    getInsumosPorSolicitud,
    getPracticasConInsumos, deleteAllSolicitudesUso, getUltimaSolicitudAprobada,
} from '../controllers/solicitudes-uso.controller.js';


const router = Router();

router.post('/solicitudes-uso', createSolicitudUso);

router.get('/solicitudes-uso', getSolicitudesUso);

router.get('/solicitudes-uso/:id', getSolicitudUsoById);

router.put('/solicitudes-uso/:id/estado', updateEstadoSolicitud);

router.post('/solicitudes-uso/:id/devolver', devolverSolicitud);
router.get('/solicitudes-uso/:id/insumos', getInsumosPorSolicitud);
router.get('/solicitudes-uso/:id/practicas', getPracticasConInsumos);
router.delete('/solicitudes', deleteAllSolicitudesUso);
router.get('/solicitudes-uso/ultima-aprobada', getUltimaSolicitudAprobada);

export default router;