import { Router } from 'express';
import {
    updateEstadoInsumoAveriado,
    getInsumosAveriados,
    getInsumoAveriadoById
} from '../controllers/insumosAveriadosController.js';

const router = Router();

router.put('/:id', updateEstadoInsumoAveriado);

router.get('/', getInsumosAveriados);

router.get('/:id', getInsumoAveriadoById);

export default router;