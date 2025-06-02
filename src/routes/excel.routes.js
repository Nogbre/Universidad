import { Router } from 'express';
import { generarExcel } from '../controllers/excel.controller.js';
const router = Router();

router.post('/generar-excel', generarExcel);

export default router; 
