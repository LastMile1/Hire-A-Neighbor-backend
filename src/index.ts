import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './core/config';
import { logger } from './core/utils/logger';
import { errorHandler } from './core/middleware/errorHandler';
import { globalRateLimiter } from './core/middleware/rateLimiter';

// Import routes
import { router as addressRouter } from './features/address';
import { router as authRouter } from './features/auth';
import { router as notificationsRouter } from './features/notifications';

const app = express();

// Apply global middleware
app.use(helmet());
app.use(cors(config.cors));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(globalRateLimiter);

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: config.env
  });
});

// Version endpoint
app.get('/version', (_req: Request, res: Response) => {
  res.json({
    version: process.env.npm_package_version || '1.0.0',
    environment: config.env
  });
});

// Apply routes
app.use('/api/v1/addresses', addressRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/notifications', notificationsRouter);

// Error handling middleware must be after all routes
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  errorHandler(err, req, res, next);
  // Don't return anything here since errorHandler will handle the response
});

// Start server
const PORT = config.port || 3000;
app.listen(PORT, () => {
  logger.info(`Server started on port ${PORT} in ${config.env} mode`);
});
