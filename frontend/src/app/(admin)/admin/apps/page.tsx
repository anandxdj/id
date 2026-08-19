import { Suspense } from 'react';
import Link from 'next/link';
import { ClientsTable } from '@/features/admin/components/ClientsTable';
import { Button } from '@/components/ui/button';
import { SectionHeading } from '@/components/ui/section-heading';

export default function AdminAppsPage() {
  return (
    <section className="space-y-6">
      <SectionHeading
        eyebrow="[ 02_APPS ]"
        title="Apps"
        description="OIDC clients registered with this provider."
        action={
          <Link href="/admin/apps/new">
            <Button size="sm">New app</Button>
          </Link>
        }
      />
      <Suspense fallback={<p className="eyebrow text-muted-foreground">LOADING...</p>}>
        <ClientsTable />
      </Suspense>
    </section>
  );
}
