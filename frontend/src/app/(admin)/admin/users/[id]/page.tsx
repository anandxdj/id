'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { UserDetail } from '@/features/admin/components/UserDetail';

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <section className="space-y-6">
      <Link
        href="/admin/users"
        className="eyebrow text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Back to users
      </Link>
      <UserDetail userId={id} />
    </section>
  );
}
