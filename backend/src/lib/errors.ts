/** Typed application errors that map cleanly to HTTP responses. */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const BadRequest = (msg: string, code = 'bad_request') => new AppError(400, code, msg);
export const Unauthorized = (msg = 'Unauthorized', code = 'unauthorized') =>
  new AppError(401, code, msg);
export const Forbidden = (msg = 'Forbidden', code = 'forbidden') => new AppError(403, code, msg);
export const NotFound = (msg = 'Not found', code = 'not_found') => new AppError(404, code, msg);
