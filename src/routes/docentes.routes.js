import { Router } from 'express';
import {
    createDocente,
    getDocentes,
    getDocenteById,
    updateDocente,
    deleteDocente, asignarAulaDocente, getAulasAsignadas
} from '../controllers/docentes.controller.js';

const router = Router();

router.post('/docentes', createDocente);

router.get('/docentes', getDocentes);

router.get('/docentes/:id', getDocenteById);

router.put('/docentes/:id', updateDocente);

router.delete('/docentes/:id', deleteDocente);

router.post('/docentes/:id/asignar-aula', asignarAulaDocente);

router.get('/docentes/:id/aulas', getAulasAsignadas);

export default router;