export class AppError extends Error {
  cause!: Error;
  constructor(message: string, cause?: Error) {
    super(message);
    if (cause) this.cause = cause;
    this.name = this.constructor.name;
  }
}

export class ValidationError extends AppError {
  errors?: Array<{path: string, message: string}>;
  constructor(message: string, cause?: Error) {
    super(message, cause);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
  }
}
