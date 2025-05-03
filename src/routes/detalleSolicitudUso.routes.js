import { Router } from 'express';
import {
    getDetallesBySolicitud,
    updateDetalle,
    deleteDetalle
} from '../controllers/detalleSolicitudUso.controller.js';

const router = Router();

router.get('/solicitudes-uso/:id_solicitud/detalles', getDetallesBySolicitud);
router.put('/detalles/:id_detalle', updateDetalle);
router.delete('/detalles/:id_detalle', deleteDetalle);

export default router;