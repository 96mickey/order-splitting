import httpStatus from 'http-status';

type APIErrorArgs = {
  message: string;
  errors?: string[];
  stack?: string;
  status?: number;
  isPublic?: boolean;
  /** Machine-readable code (architecture doc `error.code` string) */
  machineCode?: string;
};

export default class APIError extends Error {
  public errors?: string[];

  public status: number;

  public isPublic: boolean;

  public machineCode?: string;

  constructor({
    message,
    errors,
    stack,
    status = httpStatus.INTERNAL_SERVER_ERROR,
    isPublic = false,
    machineCode,
  }: APIErrorArgs) {
    super(message);
    this.name = 'APIError';
    this.errors = errors;
    this.status = status;
    this.isPublic = isPublic;
    this.stack = stack;
    this.machineCode = machineCode;
  }
}
