export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Not authenticated") {
    super(401, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Access denied") {
    super(403, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(404, message);
  }
}

export class ValidationError extends AppError {
  constructor(
    message = "Invalid data",
    public readonly issues?: unknown,
  ) {
    super(400, message);
  }
}

export function toErrorResponse(err: unknown): Response {
  if (err instanceof AppError) {
    return Response.json(
      { error: err.message, ...(err instanceof ValidationError ? { issues: err.issues } : {}) },
      { status: err.status },
    );
  }

  console.error(err);
  return Response.json({ error: "Internal error" }, { status: 500 });
}