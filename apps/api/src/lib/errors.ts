export class HttpError extends Error {
  constructor(public statusCode: number, public code: string, message?: string, public details?: unknown) {
    super(message ?? code);
  }
}
export const notFound = (what = 'Resource') => new HttpError(404, 'NOT_FOUND', `${what} not found`);
export const forbidden = () => new HttpError(403, 'FORBIDDEN', 'You do not have access to this resource');
export const conflict = (code: string, message: string) => new HttpError(409, code, message);
export const badRequest = (code: string, message: string) => new HttpError(400, code, message);
