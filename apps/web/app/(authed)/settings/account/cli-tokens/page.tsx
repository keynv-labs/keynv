import { api } from '@/lib/api';
import { type CliTokenRow, CliTokensClient } from './_components/cli-tokens-client';

export default async function CliTokensPage() {
  const { tokens } = await api<{ tokens: CliTokenRow[] }>('/v1/cli-tokens');
  return <CliTokensClient tokens={tokens} />;
}
