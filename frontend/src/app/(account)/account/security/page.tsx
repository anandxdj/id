import { SessionList } from '@/features/account/components/SessionList';

export default function SecurityPage() {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Security</h2>
        <p className="mt-1 text-sm text-white/50">Devices and browsers currently signed in to your account.</p>
      </div>
      <SessionList />
    </section>
  );
}
