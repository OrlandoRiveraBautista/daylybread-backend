import { FieldError } from "../../../entities/Errors/FieldError";

export function toBibleBrainError(err: unknown, field: string): FieldError {
  console.error(`Bible Brain error (${field}):`, err);
  return { field, message: "Bible Brain request failed" };
}
