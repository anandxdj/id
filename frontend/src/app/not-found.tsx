import { ROUTES } from '@/lib/constants';

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6">
      <p className="eyebrow text-muted-foreground">[ 404 ]</p>
      <h1 className="font-heading text-3xl font-black tracking-tight">Page not found</h1>
      <p className="max-w-md text-center text-sm text-muted-foreground">
        That path does not exist on this identity provider.
      </p>
      <a
        href={ROUTES.HOME}
        className="border-2 border-border bg-brand px-4 py-2 font-mono text-xs font-bold text-brand-foreground shadow-brutal-xs"
      >
        Home
      </a>
    </main>
  );
}
