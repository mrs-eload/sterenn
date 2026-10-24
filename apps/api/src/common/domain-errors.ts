// Services contain no HTTP code (ADR 0004 section 4), so they throw these and
// DomainErrorFilter turns them into responses.

export class NotFoundError extends Error {
  constructor(what: string, id: string) {
    super(`${what} ${id} not found`);
  }
}

export class ValidationError extends Error {
  constructor(readonly errors: string[]) {
    super(errors.join('; '));
  }
}
