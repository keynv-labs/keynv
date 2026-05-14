import { loadPreferences } from './_components/actions';
import { NotificationsForm } from './_components/form';

export default async function NotificationsPage() {
  const prefs = await loadPreferences();
  return <NotificationsForm prefs={prefs} />;
}
