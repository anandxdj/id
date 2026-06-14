import { SessionList } from '@/features/account/components/SessionList';
import { SectionHeading } from '@/components/ui/section-heading';

export default function SecurityPage() {
  return (
    <section className="space-y-6">
      <SectionHeading
        eyebrow="[ 02_SECURITY ]"
        title="Security"
        description="Devices and browsers currently signed in to your account."
      />
      <SessionList />
    </section>
  );
}
