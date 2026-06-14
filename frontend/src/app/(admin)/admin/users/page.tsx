import { UsersTable } from '@/features/admin/components/UsersTable';

export default function AdminUsersPage() {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-white">Users</h2>
      <UsersTable />
    </section>
  );
}
