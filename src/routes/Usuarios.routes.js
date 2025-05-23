import express from 'express';
import { getAllUsersConsolidated, getUsersByType } from '../controllers/Usuarios.controllers.js';

const router = express.Router();
router.get('/todos', getAllUsersConsolidated);
router.get('/:tipo', getUsersByType);
export default router;