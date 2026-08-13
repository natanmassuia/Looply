import { z } from "zod";
import { AppError } from "./errors";

export function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError(400, "Erro de validação", "validation_error", result.error.flatten());
  }
  return result.data;
}
