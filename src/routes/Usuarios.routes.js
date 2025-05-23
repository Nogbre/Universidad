import express from 'express';
import {
    getAllUsers,
    getUsersByType,
    getUserById
} from '../controllers/Usuarios.controllers.js';

const router = express.Router();

router.get('/users', getAllUsers);
router.get('/users/type/:tipo', getUsersByType);
router.get('/users/type/:tipo/id/:id', getUserById);


export default router;