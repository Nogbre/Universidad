import express from 'express';
import cors from 'cors';

const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  'exp://192.168.0.3:8081',
  'exp://192.168.0.3:8082',
  'exp://192.168.0.3:8083',
  'exp://192.168.0.3:8084',
  'https://laboratorio-web.vercel.app',
  'https://www.laboratorio-web.vercel.app',
  'http://localhost:8081',
  'http://localhost:8082',
  'http://localhost:8083',
  'http://127.0.0.1:3000'
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

import authRoutes from './routes/auth.routes.js';
import InsumosRoutes from "./routes/Insumos.routes.js";
import AlertasRoutes from "./routes/Alertas.routes.js";
import SolicitudesRoutes from './routes/Solicitudes.routes.js';
import docentesRoutes from "./routes/docentes.routes.js";
import carrerasRoutes from './routes/carreras.routes.js';
import semestresRoutes from './routes/semestres.routes.js';
import materiasRoutes from './routes/materias.routes.js';
import solicitudesUsoRoutes from './routes/solicitudes-uso.routes.js';
import practicasRoutes from './routes/practicas.routes.js';
import laboratoriosRoutes from "./routes/laboratorios.routes.js";
import encargadoRoutes from "./routes/encargado.routes.js";
import materiaLaboratorioRoutes from "./routes/materiaLaboratorio.routes.js";
import detalleSolicitudUsoRoutes from "./routes/detalleSolicitudUso.routes.js";
import insumosPorPracticaRoutes from "./routes/insumosPorPractica.routes.js";
import movimientosInventarioRoutes from "./routes/movimientosInventario.routes.js";
import estudiantesRoutes from "./routes/estudiantes.routes.js";
import usuariosRoutes from "./routes/Usuarios.routes.js";
import aulaLaboratorioRoutes from "./routes/aulaLaboratorio.routes.js";
import generarExcelSolicitudEstudianteRoutes from "./routes/solicitudesEst.routes.js";
import excelRoutes from './routes/excel.routes.js';
import excelAdquisicionRoutes from "./routes/excelAdquisicion.routes.js";


app.use('/auth', authRoutes);
app.use(InsumosRoutes);
app.use(AlertasRoutes);
app.use(SolicitudesRoutes);
app.use(docentesRoutes);
app.use('/api', usuariosRoutes);
app.use(carrerasRoutes);
app.use(semestresRoutes);
app.use(materiasRoutes);
app.use(solicitudesUsoRoutes);
app.use(practicasRoutes);
app.use(laboratoriosRoutes);
app.use(encargadoRoutes);
app.use(materiaLaboratorioRoutes);
app.use(detalleSolicitudUsoRoutes);
app.use(insumosPorPracticaRoutes);
app.use('/movimientos-inventario', movimientosInventarioRoutes);
app.use(estudiantesRoutes);
app.use(usuariosRoutes);
app.use('/aulas', aulaLaboratorioRoutes);
app.use(generarExcelSolicitudEstudianteRoutes);
app.use('/api', excelRoutes);
app.use(excelAdquisicionRoutes);


export default app;
