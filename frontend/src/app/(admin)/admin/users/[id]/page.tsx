'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { UserDetail } from '@/features/admin/components/UserDetail';

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <section className="space-y-4">
      <Link href="/admin/users" className="text-sm text-white/50 hover:text-white/80">
        ← Back to users
      </Link>
      <UserDetail userId={id} />
    </section>
  );
}
