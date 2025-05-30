import { Router } from 'express';
import { body } from 'express-validator';
// import { validarCampos } from '../middlewares/validarCampos.js';
import {
    getInsumos,
    getInsumo,
    createInsumo,
    updateInsumo,
    deleteInsumo,
    getInsumosPorUbicacion,
    getInsumosEnUsoPorEncargado,
    iniciarMantenimiento,
    finalizarMantenimiento,
    getMantenimientosActivos,
    getHistorialMantenimientos
} from '../controllers/Insumos.controllers.js'
// import { verifyToken } from '../middlewares/verifyToken.js';

const router = Router()


// const validarInsumo = [
//     body('nombre').notEmpty().withMessage('El nombre es obligatorio'),
//     body('unidad_medida').notEmpty().withMessage('La unidad de medida es obligatoria'),
//     body('stock_actual').isInt({ min: 0 }).withMessage('El stock actual debe ser un número entero mayor o igual a 0'),
//     body('stock_minimo').isInt({ min: 0 }).withMessage('El stock mínimo debe ser un número entero mayor o igual a 0'),
//     body('stock_maximo').isInt({ min: 1 }).withMessage('El stock máximo debe ser un número entero mayor a 0'),
//     validarCampos
//   ];

  
//READ
router.get('/Insumos', getInsumos)

router.get('/Insumos/:id', getInsumo)

//CREATE
router.post('/Insumos',createInsumo)

// router.post('/Insumos',verifyToken,validarInsumo, createInsumo)

//UPDATE
router.put('/Insumos/:id', updateInsumo);

//DELETE
router.delete('/Insumos/:id', deleteInsumo);

router.get('/insumos/ubicacion/:ubicacion', getInsumosPorUbicacion);

router.get('/insumos-en-uso', getInsumosEnUsoPorEncargado);

router.post('/mantenimiento', iniciarMantenimiento);
router.patch('/mantenimiento/:id/finalizar', finalizarMantenimiento);
router.get('/mantenimiento/activos', getMantenimientosActivos);
router.get('/mantenimiento', getHistorialMantenimientos);




export default router
