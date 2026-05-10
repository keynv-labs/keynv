import { cancel as clackCancel, isCancel } from '@clack/prompts';

export class UserCancelled extends Error {
  constructor() {
    super('cancelled');
    this.name = 'UserCancelled';
  }
}

/**
 * Throws UserCancelled if the clack result was cancelled. Use inside flows
 * to bubble cancellation up to the menu loop, which catches it and returns
 * to the parent menu instead of exiting the process.
 */
export function unwrap<T>(value: T | symbol): T {
  if (isCancel(value)) throw new UserCancelled();
  return value as T;
}

export function bail(message: string): never {
  clackCancel(message);
  throw new UserCancelled();
}
