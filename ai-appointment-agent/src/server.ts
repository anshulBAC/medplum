import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { AppointmentService } from './services/appointment.service';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Global appointment service instance
let appointmentService: AppointmentService;

// Routes
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'AI Appointment Agent'
  });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId, userInfo } = req.body;
    
    if (!message || !sessionId) {
      return res.status(400).json({ 
        error: 'Message and sessionId are required' 
      });
    }
    
    const response = await appointmentService.handleMessage(
      message,
      sessionId,
      userInfo
    );
    
    res.json({ 
      response, 
      sessionId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Chat API error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to process your request. Please try again.'
    });
  }
});

// Initialize services and start server
async function startServer() {
  try {
    console.log('🤖 Initializing AI Appointment Agent...');
    
    appointmentService = new AppointmentService();
    await appointmentService.initialize();
    
    app.listen(port, () => {
      console.log(`✅ AI Appointment Agent running on port ${port}`);
      console.log(`🏥 Connected to Medplum at ${process.env.MEDPLUM_BASE_URL}`);
      console.log(`🔗 Health check: http://localhost:${port}/health`);
      console.log(`💬 Chat API: http://localhost:${port}/api/chat`);
      console.log('📋 Ready to handle appointment bookings!');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down AI Appointment Agent...');
  process.exit(0);
});

startServer();
