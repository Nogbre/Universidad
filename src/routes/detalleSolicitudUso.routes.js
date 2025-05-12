import { Router } from 'express';
import {
    getDetallesBySolicitud,
    updateDetalle,
    deleteDetalle, deleteAllDetalles
} from '../controllers/detalleSolicitudUso.controller.js';

const router = Router();

router.get('/solicitudes-uso/:id_solicitud/detalles', getDetallesBySolicitud);
router.put('/detalles/:id_detalle', updateDetalle);
router.delete('/detalles/:id_detalle', deleteDetalle);
router.delete('/detalles', deleteAllDetalles);

export default router;