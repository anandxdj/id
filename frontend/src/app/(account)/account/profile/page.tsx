import { ProfileForm } from '@/features/account/components/ProfileForm';

export default function ProfilePage() {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Profile</h2>
        <p className="mt-1 text-sm text-white/50">Your details, shared with apps you grant the profile scope.</p>
      </div>
      <ProfileForm />
    </section>
  );
}
