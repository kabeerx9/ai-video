export function parseOpenRouterErrorPayload(
  payload: unknown,
  fallbackStatus: number,
): { message: string; status: number } {
  if (!payload || typeof payload !== "object") {
    return {
      message: `OpenRouter request failed (${fallbackStatus})`,
      status: fallbackStatus,
    };
  }

  const record = payload as Record<string, unknown>;
  const error = record.error;

  if (typeof error === "string") {
    return { message: error, status: fallbackStatus };
  }

  if (error && typeof error === "object") {
    const errorRecord = error as Record<string, unknown>;
    const message =
      typeof errorRecord.message === "string"
        ? errorRecord.message
        : JSON.stringify(errorRecord);
    const status =
      typeof errorRecord.code === "number" ? errorRecord.code : fallbackStatus;

    return { message, status };
  }

  if (typeof record.message === "string") {
    return { message: record.message, status: fallbackStatus };
  }

  return {
    message: `OpenRouter request failed (${fallbackStatus})`,
    status: fallbackStatus,
  };
}
