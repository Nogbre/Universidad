import { Router } from 'express';
import {
    createAula,
    getAulas,
    getAulaById,
    updateAula,
    deleteAula
} from '../controllers/aulaLaboratorio.controller.js';

const router = Router();

router.post('/', createAula);
router.get('/', getAulas);
router.get('/:id', getAulaById);
router.put('/:id', updateAula);
router.delete('/:id', deleteAula);

export default router;
