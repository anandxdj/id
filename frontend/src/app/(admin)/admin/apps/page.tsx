import Link from 'next/link';
import { ClientsTable } from '@/features/admin/components/ClientsTable';
import { Button } from '@/components/ui/button';

export default function AdminAppsPage() {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Apps</h2>
        <Link href="/admin/apps/new">
          <Button className="h-9 px-4 text-xs">New app</Button>
        </Link>
      </div>
      <ClientsTable />
    </section>
  );
}
