import Link from 'next/link';
import { CreateClientWizard } from '@/features/admin/components/CreateClientWizard';

export default function NewAppPage() {
  return (
    <section className="space-y-4">
      <Link href="/admin/apps" className="text-sm text-white/50 hover:text-white/80">
        ← Back to apps
      </Link>
      <h2 className="text-lg font-semibold text-white">Register a new app</h2>
      <CreateClientWizard />
    </section>
  );
}
