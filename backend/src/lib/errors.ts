import type { Request, Response, NextFunction, RequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { logger } from "./logger";
import { reportError } from "./errorReporter";

export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string = "error",
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (msg: string, details?: unknown) =>
  new AppError(400, msg, "bad_request", details);
export const unauthorized = (msg = "Não autenticado") =>
  new AppError(401, msg, "unauthorized");
export const forbidden = (msg = "Acesso negado") => new AppError(403, msg, "forbidden");
export const notFound = (msg = "Não encontrado") => new AppError(404, msg, "not_found");
export const conflict = (msg: string, details?: unknown) =>
  new AppError(409, msg, "conflict", details);
export const tooManyRequests = (msg = "Muitas tentativas") =>
  new AppError(429, msg, "rate_limited");

// Wrap async route handlers so thrown errors reach the error middleware.
type AsyncFn = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;
export const asyncHandler =
  (fn: AsyncFn): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);

// Map Prisma errors to clean 4xx responses without leaking internals.
function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2025") return notFound("Registro não encontrado");
    if (err.code === "P2002")
      return conflict("Violação de unicidade", { field: err.meta?.target });
    return new AppError(400, "Erro de banco de dados", "db_error");
  }
  if (err instanceof Prisma.PrismaClientValidationError) {
    return badRequest("Validação de dados falhou");
  }
  return new AppError(500, "Erro interno do servidor", "internal_error");
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const appErr = err instanceof Error && "status" in err && "code" in err
    ? new AppError(Number((err as { status: number }).status), err.message, String((err as { code: string }).code))
    : toAppError(err);
  if (appErr.status >= 500) {
    logger.error("unhandled_error", {
      requestId: res.locals.requestId,
      companyId: res.locals.companyId,
      method: req.method,
      path: req.path,
      errorName: err instanceof Error ? err.name : undefined,
      status: appErr.status,
      code: appErr.code,
      stack: err instanceof Error ? err.stack : String(err),
    });
    // Route unexpected (5xx) failures through the pluggable error-reporting
    // seam so a future Contabo deployment can connect a monitoring provider.
    reportError({
      message: appErr.message,
      errorName: err instanceof Error ? err.name : undefined,
      code: appErr.code,
      requestId: res.locals.requestId,
      companyId: res.locals.companyId,
      method: req.method,
      path: req.path,
      status: appErr.status,
      error: err,
    });
  }
  const error: Record<string, unknown> = {
    code: appErr.code,
    message: appErr.message,
  };
  if (res.locals.requestId) error.requestId = res.locals.requestId;
  if (appErr.details !== undefined) error.details = appErr.details;
  // Never leak stack traces / internals to clients.
  if (appErr.status >= 500 && process.env.NODE_ENV === "development") {
    error.stack = err instanceof Error ? err.stack : String(err);
  }
  res.status(appErr.status).json({ error });
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({
    error: {
      code: "not_found",
      message: "Rota não encontrada",
      ...(res.locals.requestId ? { requestId: res.locals.requestId } : {}),
    },
  });
}
