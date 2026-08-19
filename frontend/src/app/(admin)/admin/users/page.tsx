import { Suspense } from 'react';
import { UsersTable } from '@/features/admin/components/UsersTable';
import { SectionHeading } from '@/components/ui/section-heading';

export default function AdminUsersPage() {
  return (
    <section className="space-y-6">
      <SectionHeading
        eyebrow="[ 01_USERS ]"
        title="Users"
        description="Search the directory and manage individual accounts."
      />
      <Suspense fallback={<p className="eyebrow text-muted-foreground">LOADING...</p>}>
        <UsersTable />
      </Suspense>
    </section>
  );
}
