'use client';

import { useRouter } from 'next/navigation';
import { DataControl } from '@/features/landing/components/DataControl';
import { SectionHeading } from '@/components/ui/section-heading';

export default function DangerZonePage() {
  const router = useRouter();

  const handleSoftDelete = (message: string) => {
    // Redirect to login page upon successful soft-delete
    router.push('/login');
  };

  return (
    <section className="space-y-6">
      <SectionHeading
        eyebrow="[ 04_DANGER_ZONE ]"
        title="Danger Zone"
        description="Manage your account visibility and delete your personal data."
      />
      <div className="max-w-xl">
        <DataControl onSoftDeleteInitiated={handleSoftDelete} />
      </div>
    </section>
  );
}
