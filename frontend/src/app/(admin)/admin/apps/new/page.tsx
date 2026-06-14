import Link from 'next/link';
import { CreateClientWizard } from '@/features/admin/components/CreateClientWizard';
import { SectionHeading } from '@/components/ui/section-heading';

export default function NewAppPage() {
  return (
    <section className="space-y-6">
      <Link
        href="/admin/apps"
        className="eyebrow text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Back to apps
      </Link>
      <SectionHeading
        eyebrow="[ 02_APPS / NEW ]"
        title="Register a new app"
        description="Create an OIDC client and generate wiring guidance for it."
      />
      <CreateClientWizard />
    </section>
  );
}
