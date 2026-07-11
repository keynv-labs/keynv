/**
 * Whether this is the hosted keynv Cloud instance (keynv.dev) rather than
 * a self-hosted deployment. Self-host is the default: a self-hoster only
 * needs the panel, so the marketing landing + marketing/SEO routes are
 * gated behind this flag and keynv.dev sets KEYNV_HOSTED=true to enable
 * them.
 *
 * Accepts 'true' / '1' / 'yes' (case-insensitive); everything else is
 * self-host.
 */
export function isHostedInstance(): boolean {
  return /^(true|1|yes)$/i.test(process.env.KEYNV_HOSTED ?? '');
}
