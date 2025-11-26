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
import modelManager from './services/modelManager.js';
import backgroundProcessor from './services/backgroundProcessor.js';
import patientRoutes from './routes/patients.js';
import medicationRoutes from './routes/medications.js';
import vitalRoutes from './routes/vitals.js';
import assessmentRoutes from './routes/assessments.js';
import voiceRoutes from './routes/voice.js';
import dashboardRoutes from './routes/dashboard.js';
import configRoutes from './routes/config.js';
import barthelRoutes from './routes/barthel.js';
import incidentRoutes from './routes/incidents.js';
import sessionRoutes from './routes/sessions.js';
import carePlanRoutes from './routes/care-plans.js';
import clinicalNotesRoutes from './routes/clinicalNotes.js';
import authRoutes from './routes/auth.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.SOCKET_CORS_ORIGIN || '*', // Allow all origins for Socket.IO (LAN deployment)
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }
});

const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors({
  origin: process.env.API_CORS_ORIGIN || '*', // Allow all origins for testing (LAN deployment)
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.set('io', io);

// Initialize background processor with Socket.IO
backgroundProcessor.setSocketIO(io);

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
app.use('/api/config', configRoutes);
app.use('/api', barthelRoutes);
app.use('/api', incidentRoutes);
app.use('/api', sessionRoutes);
app.use('/api/care-plans', carePlanRoutes);
app.use('/api/clinical-notes', clinicalNotesRoutes);
app.use('/api/auth', authRoutes);

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
    // Connect to database
    await db.testConnection();
    console.log('✅ Database connected successfully');

    // Initialize AI services (optional - will fall back to mock data if unavailable)
    console.log('🤖 Initializing AI services...');
    const aiStatus = await modelManager.initialize();

    if (aiStatus.ready) {
      console.log('✅ AI services initialized and ready');
      console.log(`   Whisper: ${aiStatus.whisper ? 'Connected' : 'Unavailable'}`);
      console.log(`   Ollama: ${aiStatus.ollama ? 'Connected' : 'Unavailable'}`);

      // Optional: Pre-warm models for faster first request
      // Uncomment if you want models loaded at startup (uses more memory)
      // console.log('🔥 Pre-warming AI models...');
      // await modelManager.prewarmModels();
      // console.log('✅ Models pre-warmed');
    } else {
      console.warn('⚠️  AI services unavailable - will use fallback mode');
      console.warn('   Voice processing will return mock data');
      console.warn('   Check M2 Mac AI services are running');
    }

    // Start HTTP server
    server.listen(PORT, () => {
      console.log('');
      console.log('================================================================');
      console.log(`🏥 VerbumCare Backend running on port ${PORT}`);
      console.log('================================================================');
      console.log(`Health check:     http://localhost:${PORT}/health`);
      console.log(`Config display:   http://localhost:${PORT}/api/config/display`);
      console.log(`Environment:      ${process.env.NODE_ENV || 'development'}`);
      console.log(`AI Mode:          ${aiStatus.ready ? 'Online (Local Models)' : 'Fallback (Mock Data)'}`);
      console.log('================================================================');
      console.log('');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export { io };