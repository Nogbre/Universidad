import { Router } from 'express';
import {
  createSolicitud,
  getSolicitudes,
  getSolicitud,
  updateSolicitud,
  deleteSolicitud
} from '../controllers/Solicitudes.controllers.js';

const router = Router();

router.get   ('/solicitudes',     getSolicitudes);
router.get   ('/solicitudes/:id', getSolicitud);
router.post  ('/solicitudes',     createSolicitud);
router.put   ('/solicitudes/:id', updateSolicitud);
router.delete('/solicitudes/:id', deleteSolicitud);

export default router;
