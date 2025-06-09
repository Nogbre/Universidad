// tests/unit/controllers/insumos.controller.test.js
/* eslint-env jest */
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
} from '../../../src/controllers/Insumos.controllers.js';
import * as db from '../../../src/database/connection.js';
import sql from 'mssql';
import { gestionarAlertasInsumo } from '../../../src/helpers/alertas.js';

jest.mock('mssql');
jest.mock('../../../src/database/connection.js', () => ({
    getConnection: jest.fn(),
}));
jest.mock('../../../src/helpers/alertas.js', () => ({
    gestionarAlertasInsumo: jest.fn(),
}));

// Mock para console.log y console.error
global.console = {
    log: jest.fn(),
    error: jest.fn(),
    info: console.info,
    warn: console.warn
};

// Mocks mejorados
const mockReq = (params = {}, body = {}, query = {}) => ({
    params,
    body,
    query
});

const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res); // Añadir mock para .send si se usa en los controladores
    return res;
};

describe('Controlador de Insumos', () => {
    let mockPool;
    let mockTransaction;

    beforeEach(() => {
        jest.clearAllMocks();

        mockPool = {
            request: jest.fn().mockReturnThis(),
            input: jest.fn().mockReturnThis(),
            query: jest.fn(),
            // Agrega .transaction para que sql.connect pueda devolver un objeto con esta propiedad
            transaction: jest.fn(() => mockTransaction),
        };

        mockTransaction = {
            begin: jest.fn().mockResolvedValue(),
            commit: jest.fn().mockResolvedValue(),
            rollback: jest.fn().mockResolvedValue(),
            request: jest.fn().mockReturnThis(),
            input: jest.fn().mockReturnThis(),
            query: jest.fn(),
        };

        // Mock para la creación de transacciones
        // Asegúrate de que sql.Transaction y sus métodos estén correctamente mockeados
        sql.Transaction = jest.fn().mockImplementation(() => ({
            request: jest.fn().mockReturnThis(),
            begin: jest.fn().mockResolvedValue(),
            commit: jest.fn().mockResolvedValue(),
            rollback: jest.fn().mockResolvedValue(),
            input: jest.fn().mockReturnThis(),
            query: jest.fn(),
            // Añadir el objeto 'transaction' que contenga el método request
            transaction: {
                request: jest.fn().mockReturnThis()
            }
        }));

        db.getConnection.mockResolvedValue(mockPool);

        // Mockear sql.connect para que devuelva un pool con el método transaction
        sql.connect = jest.fn().mockResolvedValue(mockPool);
    });

    // getInsumos
    describe('getInsumos', () => {
        it('debe retornar todos los insumos', async () => {
            const req = mockReq();
            const res = mockRes();
            const mockData = [{ id: 1, nombre: 'Insumo 1' }];

            mockPool.request().query.mockResolvedValue({ recordset: mockData });

            await getInsumos(req, res);

            expect(res.json).toHaveBeenCalledWith(mockData);
        });
    });

    // getInsumo
    describe('getInsumo', () => {
        it('devuelve el insumo si existe', async () => {
            const req = mockReq({ id: '1' });
            const res = mockRes();
            const mockData = { id_insumo: 1, nombre: 'Alcohol' };

            mockPool.request().input().query.mockResolvedValue({
                rowsAffected: [1],
                recordset: [mockData]
            });

            await getInsumo(req, res);

            expect(res.json).toHaveBeenCalledWith(mockData);
        });

        it('devuelve 404 si no existe el insumo', async () => {
            const req = mockReq({ id: '999' });
            const res = mockRes();

            mockPool.request().input().query.mockResolvedValue({
                rowsAffected: [0],
                recordset: []
            });

            await getInsumo(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ message: 'Insumo not found' });
        });
    });

    // createInsumo
    describe('createInsumo', () => {
        it('crea un nuevo insumo correctamente', async () => {
            const req = mockReq({}, {
                nombre: 'Nuevo Insumo',
                stock_actual: 10,
                stock_minimo: 5
            });
            const res = mockRes();

            mockPool.request().input().query.mockResolvedValue({
                recordset: [{ id: 100 }]
            });

            await createInsumo(req, res);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                id: 100,
                nombre: 'Nuevo Insumo'
            }));
            expect(gestionarAlertasInsumo).toHaveBeenCalledWith(100);
        });
    });

    // updateInsumo
    describe('updateInsumo', () => {
        it('actualiza un insumo existente', async () => {
            const req = mockReq({ id: '1' }, {
                nombre: 'Insumo Actualizado',
                stock_actual: 15
            });
            const res = mockRes();

            mockPool.request().input().query.mockResolvedValue({
                rowsAffected: [1]
            });

            await updateInsumo(req, res);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                id: '1',
                nombre: 'Insumo Actualizado'
            }));
            expect(gestionarAlertasInsumo).toHaveBeenCalledWith('1');
        });

        it('retorna 404 si el insumo no existe', async () => {
            const req = mockReq({ id: '999' }, { nombre: 'No existe' });
            const res = mockRes();

            mockPool.request().input().query.mockResolvedValue({
                rowsAffected: [0]
            });

            await updateInsumo(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });
    });

    // deleteInsumo
    describe('deleteInsumo', () => {
        it('elimina un insumo y sus alertas asociadas', async () => {
            const req = mockReq({ id: '1' });
            const res = mockRes();

            mockPool.request().input().query
                .mockResolvedValueOnce({}) // Eliminación de alertas
                .mockResolvedValueOnce({ rowsAffected: [1] }); // Eliminación de insumo

            await deleteInsumo(req, res);

            expect(res.json).toHaveBeenCalledWith({ message: 'Insumo eliminado correctamente' });
        });

        it('maneja errores al eliminar', async () => {
            const req = mockReq({ id: '1' });
            const res = mockRes();

            mockPool.request().input().query.mockRejectedValue(new Error('Delete Error'));

            await deleteInsumo(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    // getInsumosPorUbicacion
    describe('getInsumosPorUbicacion', () => {
        it('retorna insumos por ubicación', async () => {
            const req = mockReq({ ubicacion: 'Lab1' });
            const res = mockRes();
            const mockData = [{ id: 1, ubicacion: 'Lab1' }];

            mockPool.request().input().query.mockResolvedValue({ recordset: mockData });

            await getInsumosPorUbicacion(req, res);

            expect(res.json).toHaveBeenCalledWith(mockData);
        });
    });

    // getInsumosEnUsoPorEncargado
    describe('getInsumosEnUsoPorEncargado', () => {
        it('retorna insumos en uso por encargado', async () => {
            const req = mockReq({}, {}, { id_encargado: '5' });
            const res = mockRes();
            const mockData = [{ id_insumo: 1, insumo_nombre: 'Insumo en uso' }];

            mockPool.request().input().query.mockResolvedValue({ recordset: mockData });

            await getInsumosEnUsoPorEncargado(req, res);

            expect(res.json).toHaveBeenCalledWith(mockData);
        });

        it('retorna error si falta id_encargado', async () => {
            const req = mockReq({}, {}, {});
            const res = mockRes();

            await getInsumosEnUsoPorEncargado(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    // getMantenimientosActivos
    describe('getMantenimientosActivos', () => {
        it('retorna mantenimientos activos', async () => {
            const req = mockReq();
            const res = mockRes();
            const mockData = [{ id: 100, estado: 'En Mantenimiento' }];

            mockPool.request().query.mockResolvedValue({ recordset: mockData });

            await getMantenimientosActivos(req, res);

            expect(res.json).toHaveBeenCalledWith(mockData);
        });
    });

    // getHistorialMantenimientos
    describe('getHistorialMantenimientos', () => {
        it('retorna historial de mantenimientos', async () => {
            const req = mockReq();
            const res = mockRes();
            const mockData = [{ id: 100 }, { id: 101 }];

            mockPool.request().query.mockResolvedValue({ recordset: mockData });

            await getHistorialMantenimientos(req, res);

            expect(res.json).toHaveBeenCalledWith(mockData);
        });
    });
});