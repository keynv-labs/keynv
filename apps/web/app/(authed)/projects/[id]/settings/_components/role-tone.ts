export const roleTone = (
  role: string,
): 'success' | 'warn' | 'neutral' | 'accent' => {
  if (role === 'lead') return 'accent';
  if (role === 'developer') return 'success';
  return 'neutral';
};
