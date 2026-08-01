import { FieldError } from "../../../entities/Errors/FieldError";

export function toBibleBrainError(err: unknown, field: string): FieldError {
  let message = "Bible Brain request failed";

  if (typeof err === "string") {
    message = err;
  } else if (err instanceof Error) {
    message = err.message;
  } else if (
    err &&
    typeof err === "object" &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
  ) {
    message = (err as { message: string }).message;
  }

  return { field, message };
}
