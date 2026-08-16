import Link from 'next/link';
import { CreateClientWizard } from '@/features/admin/components/CreateClientWizard';
import { SectionHeading } from '@/components/ui/section-heading';

export default function NewAppPage() {
  return (
    <section className="space-y-6 pb-12">
      <Link
        href="/admin/apps"
        className="eyebrow text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Back to apps
      </Link>
      <SectionHeading
        eyebrow="[ 02_APPS / NEW ]"
        title="Connect a new app"
        description="Tell us where it runs. We’ll configure the secure OAuth profile for you."
      />
      <CreateClientWizard />
    </section>
  );
}
