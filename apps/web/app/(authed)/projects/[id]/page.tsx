import { redirect } from 'next/navigation';

/**
 * Project root redirects to the Secrets tab — that's the daily-use
 * surface. The previous Overview page surfaced a stats summary, but
 * those numbers now live in the top-line cluster of the Activity feed
 * and the Secrets page header, so the extra hop is unnecessary.
 */
export default async function ProjectIndex({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/projects/${id}/secrets`);
}
