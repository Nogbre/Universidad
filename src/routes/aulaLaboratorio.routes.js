import { Router } from 'express';
import {
    createAula,
    getAulas,
    getAulaById,
    updateAula,
    deleteAula
} from '../controllers/aulaLaboratorio.controller.js';

const router = Router();

router.post('/aulas', createAula);
router.get('/aulas', getAulas);
router.get('/aulas/:id', getAulaById);
router.put('/aulas/:id', updateAula);
router.delete('/aulas/:id', deleteAula);

export default router;