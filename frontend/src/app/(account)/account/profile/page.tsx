import { ProfileForm } from '@/features/account/components/ProfileForm';
import { SectionHeading } from '@/components/ui/section-heading';

export default function ProfilePage() {
  return (
    <section className="space-y-6">
      <SectionHeading
        eyebrow="[ 03_PROFILE ]"
        title="Profile"
        description="Your details, shared with apps you grant the profile scope."
      />
      <ProfileForm />
    </section>
  );
}
