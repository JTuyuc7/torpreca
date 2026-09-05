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

// Thrown by core/middleware/auth.ts when the user's `status` isn't "active"
// (pending approval, rejected, or deactivated) — carries a machine-readable
// `code` so the mobile/dashboard client can show the right message from its
// own i18n dictionary instead of a generic "access denied" (see the
// self-signup design doc).
export type AccountStatusCode = "PENDING_APPROVAL" | "REJECTED" | "DEACTIVATED";

export class AccountStatusError extends ForbiddenError {
  constructor(public readonly code: AccountStatusCode) {
    super(`Account status: ${code}`);
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
      {
        error: err.message,
        ...(err instanceof ValidationError ? { issues: err.issues } : {}),
        ...(err instanceof AccountStatusError ? { code: err.code } : {}),
      },
      { status: err.status },
    );
  }

  console.error(err);
  return Response.json({ error: "Internal error" }, { status: 500 });
}
