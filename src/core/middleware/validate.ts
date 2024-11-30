import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError } from '../errors/errors';

type RequestLocation = 'body' | 'query' | 'params';

export const validate = (location: RequestLocation, schema: z.ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req[location];
      const validatedData = await schema.parseAsync(data);
      req[location] = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formattedErrors = error.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message
        }));
        const validationError = new ValidationError('Validation failed');
        (validationError as any).errors = formattedErrors;
        next(validationError);
      } else {
        next(error);
      }
    }
  };
};
