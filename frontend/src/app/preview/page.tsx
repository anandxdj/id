'use client';

/**
 * Brutalist design-system preview. Not linked in nav, no auth.
 * Visit /preview to eyeball every primitive + the theme toggle.
 */

import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Panel } from '@/components/ui/panel';
import { ThemeToggle } from '@/components/ui/theme-toggle';

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <p className="eyebrow text-muted-foreground">{label}</p>
      <div className="flex flex-wrap items-start gap-4">{children}</div>
    </section>
  );
}

export default function PreviewPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-12 md:px-16">
      <div className="mx-auto max-w-5xl space-y-12">
        {/* header */}
        <header className="flex items-end justify-between border-b-2 border-border pb-6">
          <div>
            <p className="eyebrow text-muted-foreground">[ DESIGN_SYSTEM / V1 ]</p>
            <h1 className="mt-2 font-heading text-4xl font-bold tracking-tight">
              id<span className="text-muted-foreground">/brutalist</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Black / white. One swappable accent token (<code className="font-mono">--brand</code>).
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="eyebrow text-muted-foreground">THEME</span>
            <ThemeToggle />
          </div>
        </header>

        <Section label="[ BUTTONS / VARIANTS ]">
          <Button variant="primary">Authorize</Button>
          <Button variant="secondary">Cancel</Button>
          <Button variant="danger">Revoke</Button>
          <Button variant="ghost">Skip</Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
        </Section>

        <Section label="[ BUTTONS / SIZES ]">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </Section>

        <Section label="[ BADGES / STATUS ]">
          <Badge>Default</Badge>
          <Badge tone="ok">Active</Badge>
          <Badge tone="danger">Suspended</Badge>
          <Badge tone="warn">Dormant</Badge>
          <Badge tone="muted">Draft</Badge>
        </Section>

        <Section label="[ FORM / INPUTS ]">
          <div className="w-72 space-y-3">
            <div>
              <Label htmlFor="e">Email</Label>
              <Input id="e" placeholder="you@internal.dev" />
            </div>
            <div>
              <Label htmlFor="p">Password</Label>
              <Input id="p" type="password" placeholder="••••••••" />
            </div>
            <Button className="w-full">Sign in</Button>
          </div>
        </Section>

        <Section label="[ CARD ]">
          <Card>
            <CardTitle>Connected app</CardTitle>
            <CardDescription>Last used 3m ago · 2 scopes</CardDescription>
            <div className="mt-4 flex gap-2">
              <Button size="sm" variant="secondary">
                Details
              </Button>
              <Button size="sm" variant="danger">
                Revoke
              </Button>
            </div>
          </Card>
        </Section>

        <Section label="[ PANEL ]">
          <Panel className="w-full max-w-md" label="[ 01_ACTIVE_SESSIONS ]" action={<Badge tone="ok">3</Badge>}>
            <div className="space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span>Chrome · Windows</span>
                <Badge tone="default">CURRENT</Badge>
              </div>
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span>Safari · iPhone</span>
                <span className="text-muted-foreground">2h ago</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Firefox · Linux</span>
                <span className="text-muted-foreground">1d ago</span>
              </div>
            </div>
          </Panel>
        </Section>
      </div>
    </main>
  );
}
