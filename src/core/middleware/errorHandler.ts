import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger';

export class AppError extends Error {
  public metadata?: Record<string, any>;

  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true,
    metadata?: Record<string, any>
  ) {
    super(message);
    this.metadata = metadata;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log error
  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Handle specific error types
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
      isOperational: err.isOperational,
      ...(err.metadata && { metadata: err.metadata }),
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation error',
      errors: err.errors,
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Handle common Prisma errors
    switch (err.code) {
      case 'P2002':
        return res.status(409).json({
          status: 'error',
          message: 'A unique constraint would be violated.',
        });
      case 'P2025':
        return res.status(404).json({
          status: 'error',
          message: 'Record not found.',
        });
      default:
        return res.status(500).json({
          status: 'error',
          message: 'Database error occurred.',
        });
    }
  }

  // Handle unknown errors
  return res.status(500).json({
    status: 'error',
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal server error'
      : err.message,
  });
};
