import type { SafeParseError, z } from 'zod';

export type ActionResult = {
  error?: string;
  ok?: string;
};

/** Convenience alias consumed by server-action callers. */
export type ActionState = ActionResult;

function formatZodIssues(error: SafeParseError<unknown>['error']): string {
  return error.issues.map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`).join('; ');
}

export function parseOr<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  formData: FormData,
  keys: (keyof z.infer<z.ZodObject<T>>)[],
): { success: true; data: z.infer<z.ZodObject<T>> } | { success: false; error: string } {
  const raw: Record<string, FormDataEntryValue | null> = {};
  for (const key of keys) {
    raw[key as string] = formData.get(key as string);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: formatZodIssues(parsed.error) };
  }
  return { success: true, data: parsed.data };
}

export function parseRaw<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  raw: Record<string, unknown>,
): { success: true; data: z.infer<z.ZodObject<T>> } | { success: false; error: string } {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: formatZodIssues(parsed.error) };
  }
  return { success: true, data: parsed.data };
}

/**
 * Wraps an API call: on success returns `{ success: true; data: T }`,
 * on error returns `{ success: false; error: string }`.
 */
export async function catchApi<T>(
  fn: () => Promise<T>,
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (err) {
    const e = err as { message?: string };
    return { success: false, error: e?.message ?? String(err) };
  }
}

/** Narrow helper: use like `if (!caught(result)) return { error: result.error }`. */
export function caught<T>(
  r: { success: true; data: T } | { success: false; error: string },
): r is { success: false; error: string } {
  return !r.success;
}
