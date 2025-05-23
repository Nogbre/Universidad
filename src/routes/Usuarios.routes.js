import express from 'express';
import { getAllUsers } from '../controllers/Usuarios.controllers.js';

const router = express.Router();

/**
 * @swagger
 * /usuarios:
 *   get:
 *     summary: Obtiene usuarios con filtros
 *     parameters:
 *       - in: query
 *         name: tipo
 *         schema: { type: string, enum: [docentes, estudiantes] }
 *       - in: query
 *         name: nombre
 *         schema: { type: string }
 *       - in: query
 *         name: apellido
 *         schema: { type: string }
 *       - in: query
 *         name: correo
 *         schema: { type: string }
 *       - in: query
 *         name: id_carrera
 *         schema: { type: integer }
 *       - in: query
 *         name: facultad
 *         schema: { type: string }
 *       - in: query
 *         name: id_materia
 *         schema: { type: integer }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 */
router.get('/', getAllUsers);

export default router;