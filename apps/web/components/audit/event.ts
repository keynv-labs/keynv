/**
 * Helpers shared by the org-level and project-level audit pages.
 */

export type Category =
  | 'project'
  | 'secret'
  | 'member'
  | 'user'
  | 'auth'
  | 'approval'
  | 'other';

export const CATEGORY_LABELS: Record<Category, string> = {
  project: 'Project',
  secret: 'Secret',
  member: 'Member',
  user: 'User',
  auth: 'Auth',
  approval: 'Approval',
  other: 'Other',
};

const KNOWN_PREFIXES: ReadonlySet<Category> = new Set([
  'project',
  'secret',
  'member',
  'user',
  'auth',
  'approval',
]);

export function categoryOf(eventType: string): Category {
  const prefix = eventType.split('.')[0];
  if (prefix && KNOWN_PREFIXES.has(prefix as Category)) return prefix as Category;
  return 'other';
}

export type Tone = 'neutral' | 'success' | 'warn' | 'danger';

interface Description {
  verb: string;
  subject: string;
  /** Optional mono-render hint for the subject. */
  subjectMono?: boolean;
  tone?: Tone;
}

function pickString(payload: Record<string, unknown> | null | undefined, ...keys: string[]): string {
  if (!payload) return '';
  for (const k of keys) {
    const v = payload[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return '';
}

export function describeEvent(
  eventType: string,
  payload: Record<string, unknown> | null,
): Description {
  switch (eventType) {
    case 'project.created':
      return { verb: 'created project', subject: pickString(payload, 'name'), subjectMono: true };
    case 'project.deleted':
      return { verb: 'deleted project', subject: pickString(payload, 'name'), subjectMono: true };
    case 'secret.created':
      return {
        verb: 'created secret',
        subject: pickString(payload, 'alias'),
        subjectMono: true,
        tone: 'success',
      };
    case 'secret.rotated':
      return {
        verb: 'rotated',
        subject: pickString(payload, 'alias'),
        subjectMono: true,
      };
    case 'secret.deleted':
      return {
        verb: 'deleted secret',
        subject: pickString(payload, 'alias'),
        subjectMono: true,
        tone: 'danger',
      };
    case 'secret.read.allowed':
      return {
        verb: 'accessed',
        subject: pickString(payload, 'alias'),
        subjectMono: true,
      };
    case 'secret.read.denied':
      return {
        verb: 'denied access to',
        subject: pickString(payload, 'alias'),
        subjectMono: true,
        tone: 'danger',
      };
    case 'approval.requested':
      return {
        verb: 'requested access to',
        subject: pickString(payload, 'alias'),
        subjectMono: true,
        tone: 'warn',
      };
    case 'member.added':
      return {
        verb: 'added member',
        subject: pickString(payload, 'user_email', 'user_id'),
      };
    case 'member.removed':
      return {
        verb: 'removed member',
        subject: pickString(payload, 'user_email', 'user_id'),
      };
    case 'member.role_changed':
      return {
        verb: 'changed role of',
        subject: pickString(payload, 'user_email', 'user_id'),
      };
    case 'user.invited':
      return { verb: 'invited', subject: pickString(payload, 'email') };
    case 'user.role_changed':
      return {
        verb: 'changed role of',
        subject: pickString(payload, 'email'),
      };
    case 'auth.login.allowed':
      return { verb: 'signed in', subject: '' };
    case 'auth.login.denied':
      return { verb: 'failed to sign in', subject: '', tone: 'danger' };
    case 'auth.refresh':
      return { verb: 'refreshed session', subject: '' };
    case 'auth.logout':
      return { verb: 'signed out', subject: '' };
    default:
      return { verb: eventType, subject: '' };
  }
}

export function actorInitials(userId: string | null, agent: string): string {
  if (!userId) return '⚙';
  const stripped = userId.replace(/^u_/, '');
  return stripped.slice(0, 2).toUpperCase() || agent.slice(0, 2).toUpperCase() || '??';
}

export function dayBucket(iso: string): { key: string; label: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { key: 'unknown', label: 'Unknown date' };
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  if (sameDay(d, today)) return { key, label: 'Today' };
  if (sameDay(d, yesterday)) return { key, label: 'Yesterday' };
  const sameYear = d.getFullYear() === today.getFullYear();
  return {
    key,
    label: d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      ...(sameYear ? {} : { year: 'numeric' }),
    }),
  };
}

export function relativeTime(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return '';
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}
