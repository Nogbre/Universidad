import { Router } from 'express';
import {
    addInsumoAPractica,
    updateCantidadRequerida,
    getInsumosPorPractica,
    getInsumoPracticaById,
    deleteInsumoDePractica
} from '../controllers/insumosPorPractica.controller.js';

const router = Router();

router.post('/practicas/:id_practica/insumos', addInsumoAPractica);
router.put('/practicas/:id_practica/insumos/:id_insumo', updateCantidadRequerida);
router.get('/practicas/:id_practica/insumos', getInsumosPorPractica);
router.get('/practicas/:id_practica/insumos/:id_insumo', getInsumoPracticaById);
router.delete('/practicas/:id_practica/insumos/:id_insumo', deleteInsumoDePractica);

export default router;