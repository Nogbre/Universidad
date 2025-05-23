import express from 'express';
import { getAllUsersConsolidated } from '../controllers/Usuarios.controllers.js';

const router = express.Router();
router.get('/', getAllUsersConsolidated);

export default router;