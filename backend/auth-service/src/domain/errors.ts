// =============================================================================
// DOMAIN ERRORS — Auth bounded context
// =============================================================================
// Custom error classes for domain-level business rule violations.
// These are caught by DomainExceptionFilter and mapped to HTTP status codes.

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid email or password');
    this.name = 'InvalidCredentialsError';
  }
}

export class UserNotFoundError extends Error {
  constructor(userId: string) {
    super(`User not found: ${userId}`);
    this.name = 'UserNotFoundError';
  }
}

export class DuplicateEmailError extends Error {
  constructor(email: string) {
    super(`Email already registered: ${email}`);
    this.name = 'DuplicateEmailError';
  }
}

export class InactiveUserError extends Error {
  constructor() {
    super('User account is inactive');
    this.name = 'InactiveUserError';
  }
}
