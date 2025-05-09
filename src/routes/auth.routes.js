import express from 'express';
import { loginDocente,loginEncargado  } from '../controllers/authController.js';
const router = express.Router();

router.post('/login', loginDocente);
router.post('/encargado-login', loginEncargado); 

export default router;
