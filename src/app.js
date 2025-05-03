import express from 'express';


import cors from 'cors';



const app = express(); 

app.use(cors({
    origin: 'http://localhost:5173', 
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }));


app.use(express.json());

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



// app.use(usuariosRoutes);  
app.use(InsumosRoutes); 
app.use(AlertasRoutes);
app.use(SolicitudesRoutes);
app.use(docentesRoutes);
app.use(carrerasRoutes);
app.use(semestresRoutes);
app.use(materiasRoutes);
app.use(solicitudesUsoRoutes);
app.use(practicasRoutes);
app.use(laboratoriosRoutes);
app.use(encargadoRoutes);
app.use(materiaLaboratorioRoutes);
app.use(detalleSolicitudUsoRoutes);



  


export default app;
