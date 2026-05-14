import { api } from '@/lib/api';
import { type CliTokenRow, CliTokensClient } from './_components/cli-tokens-client';

export default async function CliTokensPage() {
  const { tokens, next_cursor } = await api<{
    tokens: CliTokenRow[];
    next_cursor: string | null;
  }>('/v1/cli-tokens', { query: { limit: 50 } });
  return <CliTokensClient tokens={tokens} nextCursor={next_cursor} />;
}
