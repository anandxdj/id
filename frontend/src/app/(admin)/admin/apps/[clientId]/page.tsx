'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ClientDetail } from '@/features/admin/components/ClientDetail';

export default function AdminClientDetailPage() {
  const { clientId } = useParams<{ clientId: string }>();
  return (
    <section className="space-y-6">
      <Link
        href="/admin/apps"
        className="eyebrow inline-flex items-center text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Back to apps
      </Link>
      <ClientDetail clientId={clientId} />
    </section>
  );
}
