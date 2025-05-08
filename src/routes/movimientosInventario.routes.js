import { Router } from 'express';
import { getMovimientos, getMovimientoById } from '../controllers/movimientosInventario.controller.js';

const router = Router();

router.get('/', getMovimientos);

router.get('/:id', getMovimientoById);

export default router;