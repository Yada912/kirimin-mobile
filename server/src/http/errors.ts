/**
 * Throw an HttpError anywhere in a handler; the server turns it into
 * `{ "error": { "code", "message", "details" } }` with the right status code.
 */
export class HttpError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) => new HttpError(400, 'bad_request', message, details);
export const unauthorized = (message = 'Silakan masuk terlebih dahulu') => new HttpError(401, 'unauthorized', message);
export const forbidden = (message = 'Kamu tidak punya akses ke data ini') => new HttpError(403, 'forbidden', message);
export const notFound = (what = 'Data') => new HttpError(404, 'not_found', `${what} tidak ditemukan`);
export const conflict = (message: string, details?: unknown) => new HttpError(409, 'conflict', message, details);
