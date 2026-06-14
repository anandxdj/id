import { AppList } from '@/features/account/components/AppList';

export default function ConnectedAppsPage() {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Connected apps</h2>
        <p className="mt-1 text-sm text-white/50">Apps you’ve allowed to sign in with your id account.</p>
      </div>
      <AppList />
    </section>
  );
}
