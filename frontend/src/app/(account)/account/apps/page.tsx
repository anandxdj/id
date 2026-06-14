import { AppList } from '@/features/account/components/AppList';
import { SectionHeading } from '@/components/ui/section-heading';

export default function ConnectedAppsPage() {
  return (
    <section className="space-y-6">
      <SectionHeading
        eyebrow="[ 01_CONNECTED_APPS ]"
        title="Connected apps"
        description="Apps you’ve allowed to sign in with your id account."
      />
      <AppList />
    </section>
  );
}
