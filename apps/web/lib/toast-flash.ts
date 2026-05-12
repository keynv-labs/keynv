/**
 * Cross-page toast flashing via `?toast=<key>` search params.
 *
 * Server actions that redirect (e.g. successful password reset →
 * /login) can't directly call notify.success because the toast
 * surface lives on the client. The convention:
 *
 *   1. Redirect with `?toast=<key>` (and optionally `?toastMsg=...`)
 *   2. Destination page mounts <ToastFlashHandler /> as a client child
 *   3. The handler reads the param, fires notify, then strips it
 *      from the URL so a refresh doesn't re-fire
 *
 * Predefined keys live in TOAST_FLASH_REGISTRY so the destination
 * doesn't have to know about every sender. Custom messages can use
 * `?toast=custom&toastMsg=...` — those get scrubbed via the standard
 * pipeline.
 */

export type ToastFlashKey =
  | 'password_reset_sent'
  | 'password_reset_success'
  | 'email_verified'
  | 'email_verify_sent'
  | 'signed_out'
  | 'project_created'
  | 'custom';

export interface ToastFlashEntry {
  level: 'success' | 'info' | 'error';
  message: string;
  description?: string;
}

export const TOAST_FLASH_REGISTRY: Record<Exclude<ToastFlashKey, 'custom'>, ToastFlashEntry> = {
  password_reset_sent: {
    level: 'success',
    message: 'Check your inbox',
    description: "If an account exists for that email, we've sent reset instructions.",
  },
  password_reset_success: {
    level: 'success',
    message: 'Password updated',
    description: 'Sign in with your new password.',
  },
  email_verified: {
    level: 'success',
    message: 'Email verified',
    description: 'Your account is ready to go.',
  },
  email_verify_sent: {
    level: 'info',
    message: 'Verification email sent',
    description: 'Open the link in the email to finish setup.',
  },
  signed_out: {
    level: 'info',
    message: 'Signed out',
  },
  project_created: {
    level: 'success',
    message: 'Project created',
  },
};
