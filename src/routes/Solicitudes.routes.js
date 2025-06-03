import { Router } from 'express';
import {
  createSolicitudAdq,
  getSolicitudesAdq,
  getSolicitudAdq,
  updateSolicitudAdq,
  deleteSolicitudAdq
} from '../controllers/Solicitudes.controllers.js';

const router = Router();

router.get('/solicitudes',       getSolicitudesAdq);
router.get('/solicitudes/:id',   getSolicitudAdq);
router.post('/solicitudes',      createSolicitudAdq);
router.put('/solicitudes/:id',   updateSolicitudAdq);
router.delete('/solicitudes/:id',deleteSolicitudAdq);

export default router;
