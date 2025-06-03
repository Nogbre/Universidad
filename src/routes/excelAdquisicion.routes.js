import { Router } from 'express';
import { generarExcelSolicitudAdquisicion }
    from '../controllers/solicitudesAdq.excel.controller.js';

const router = Router();

router.get('/solicitudes-adquisicion/:id/excel',
    generarExcelSolicitudAdquisicion);

export default router;
