import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import db from './db/index.js';
import patientRoutes from './routes/patients.js';
import medicationRoutes from './routes/medications.js';
import vitalRoutes from './routes/vitals.js';
import assessmentRoutes from './routes/assessments.js';
import voiceRoutes from './routes/voice.js';
import dashboardRoutes from './routes/dashboard.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URLS?.split(',') || ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:19006'],
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URLS?.split(',') || ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:19006']
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.set('io', io);

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.use('/api/patients', patientRoutes);
app.use('/api/medications', medicationRoutes);
app.use('/api/vitals', vitalRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);

  const language = req.headers['accept-language'] || 'en';
  const errorMessages = {
    'en': 'Internal server error',
    'ja': 'サーバー内部エラー',
    'zh-TW': '伺服器內部錯誤'
  };

  res.status(err.status || 500).json({
    error: errorMessages[language] || errorMessages['en'],
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    language
  });
});

io.on('connection', (socket) => {
  console.log('Dashboard client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Dashboard client disconnected:', socket.id);
  });

  socket.on('join-facility', (facilityId) => {
    socket.join(`facility-${facilityId}`);
    console.log(`Socket ${socket.id} joined facility ${facilityId}`);
  });
});

async function startServer() {
  try {
    await db.testConnection();
    console.log('Database connected successfully');

    server.listen(PORT, () => {
      console.log(`VerbumCare Backend running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export { io };