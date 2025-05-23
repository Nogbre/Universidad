import express from 'express';
import {
    getAllUsers,
    getUsersByType,
    getUserById
} from '../controllers/Usuarios.controllers.js';

const router = express.Router();

router.get('/', getAllUsers);
router.get('/:tipo', getUsersByType);
router.get('/:tipo/:id', getUserById);

export default router;