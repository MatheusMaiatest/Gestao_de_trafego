import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { DatabaseManager } from './database/DatabaseManager';
import { logger } from './utils/logger';

// Rotas
import dashboardRoutes from './routes/dashboard.routes';
import clientRoutes from './routes/clients.routes';
import segmentRoutes from './routes/segments.routes';
import rfmRoutes from './routes/rfm.routes';
import productRoutes from './routes/products.routes';
import geolocationRoutes from './routes/geolocation.routes';
import campaignRoutes from './routes/campaign.routes';

// Carregar variáveis de ambiente
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3001;

// Database Manager
let dbManager: DatabaseManager;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || '*',
  credentials: true
}));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/segments', segmentRoutes);
app.use('/api/rfm', rfmRoutes);
app.use('/api/products', productRoutes);
app.use('/api/geolocation', geolocationRoutes);
app.use('/api/campaign', campaignRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found',
      path: req.path,
      timestamp: new Date().toISOString()
    }
  });
});

// Error handler
app.use((err: any, req: Request, res: Response, _next: any) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path
  });

  res.status(err.status || 500).json({
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'Internal server error',
      timestamp: new Date().toISOString()
    }
  });
});

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database
    dbManager = new DatabaseManager();
    const isConnected = await dbManager.testConnection();
    
    if (!isConnected) {
      throw new Error('Failed to connect to database');
    }

    logger.info('Database connected successfully');

    // Make dbManager available globally
    (global as any).dbManager = dbManager;

    // Start server
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      console.log(`🚀 Server ready at http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
    });

  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  if (dbManager) {
    await dbManager.close();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing HTTP server');
  if (dbManager) {
    await dbManager.close();
  }
  process.exit(0);
});

// Start the server
startServer();

export default app;
