import { Router } from 'express';
import {
    getMovimientos,
    getMovimientoById,
    deleteAllMovimientos
} from '../controllers/movimientosInventario.controller.js';

const router = Router();

router.get('/', getMovimientos);

router.get('/:id', getMovimientoById);

router.delete('/', deleteAllMovimientos);

export default router;