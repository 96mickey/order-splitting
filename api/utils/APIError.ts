import httpStatus from 'http-status';

type APIErrorArgs = {
  message: string;
  errors?: string[];
  stack?: string;
  status?: number;
  isPublic?: boolean;
};

export default class APIError extends Error {
  public errors?: string[];

  public status: number;

  public isPublic: boolean;

  constructor({ message, errors, stack, status = httpStatus.INTERNAL_SERVER_ERROR, isPublic = false }: APIErrorArgs) {
    super(message);
    this.name = 'APIError';
    this.errors = errors;
    this.status = status;
    this.isPublic = isPublic;
    this.stack = stack;
  }
}
