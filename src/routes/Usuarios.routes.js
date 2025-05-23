import express from 'express';
import {
    getAllUsers
} from '../controllers/Usuarios.controllers.js';

const router = express.Router();

router.get('/usuarios', getAllUsers);


export default router;