import express from 'express';
import { loginDocente } from '../controllers/authController.js';
const router = express.Router();

router.post('/login', loginDocente);

export default router;
