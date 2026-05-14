export type Tone =
  | 'neutral'
  | 'accent'
  | 'success'
  | 'warn'
  | 'danger'
  | 'env-dev'
  | 'env-stg'
  | 'env-prod';

/** Maps a tier string ("dev", "staging", "prod", etc.) to a Badge tone. */
export function envTone(tier: string): Tone {
  const t = tier.toLowerCase();
  if (t === 'prod' || t === 'production') return 'env-prod';
  if (t === 'stg' || t === 'staging') return 'env-stg';
  return 'env-dev';
}
