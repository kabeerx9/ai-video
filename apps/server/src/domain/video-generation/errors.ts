export class JobNotFoundError extends Error {
  constructor() {
    super("Generation job not found");
    this.name = "JobNotFoundError";
  }
}

export class OpenRouterApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "OpenRouterApiError";
    this.status = status;
  }
}
