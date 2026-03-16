export class GuardError extends Error {
  public readonly code: string;

  public constructor(code: string, message: string) {
    super(message);
    this.name = 'GuardError';
    this.code = code;
  }
}
