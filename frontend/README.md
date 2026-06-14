# id — Frontend

Next.js 15 (App Router) · React 19 · Tailwind v4. Feature-based layout. Houses every user-facing
surface of the OIDC provider behind a single **brutalist design system**.

## Surfaces

| Route group | Surface | Intensity |
|-------------|---------|-----------|
| `/` | Landing page — hero, animated OIDC-handshake terminal, feature grid | loud |
| `(auth)` | `/login`, `/consent`, `/callback` | loud |
| `(account)` | `/account` + `/account/{apps,security,profile}` — Google-style self-service | structural |
| `(admin)` | `/admin` + users / apps (role-gated) | structural |

`/` is a real landing page (it does **not** redirect to `/account`). `(account)` is behind
`authenticate` only — any signed-in user; `(admin)` additionally requires an admin role
(server-enforced; the client gate is convenience).

## Design system (brutalist)

Black/white by design, light **and** dark. Sharp corners, full-contrast ink borders, hard offset
shadows, mono eyebrow labels. Two intensities: **loud** (landing/auth) and **structural**
(dashboards — readable density for tables/forms).

### One swappable accent

The product is intentionally monochrome. The single signature accent lives in **one token** —
`--brand` (+ `--brand-foreground`) in `src/app/globals.css`. It defaults to `var(--foreground)` so
accent fills read as inverted blocks. To colorize the whole product, change **one line**:

```css
/* src/app/globals.css */
:root, .dark { --brand: #C6F702; --brand-foreground: #000; }
```

Every primary button, badge, active tab, and the statement band flip instantly. Status colors
(`--ok` / `--danger` / `--warn`) are independent and never repurposed for branding.

### Tokens & utilities

- **Color tokens** (Tailwind classes): `bg-background`, `bg-card`, `bg-muted`, `text-foreground`,
  `text-muted-foreground`, `border-border`, `text/bg-brand`, `text/bg-ok|danger|warn`.
- **Hard shadows**: `shadow-brutal-xs|sm|(default)|lg|xl` — offset in the foreground ink, auto-flips
  black↔white per theme.
- **`eyebrow`** — tiny mono uppercase tracking label (the `[ 01_SECTION ]` tag).
- Radius tokens are `0` (brutalist sharp corners) — don't add `rounded-*`.

### Primitives (`src/components/ui/`)

`Button` (variants `primary`/`secondary`/`danger`/`ghost`, sizes `sm`/`md`/`lg`), `Card`, `Input`,
`Label`, `Badge` (tones `default`/`ok`/`danger`/`warn`/`muted`), `Panel` (bordered box + mono header
strip), `SectionHeading`, `ThemeToggle`.

## Theming

`next-themes`, dark default, `attribute="class"`. `ThemeToggle` swaps light↔dark with a View
Transition **circle reveal**, or plays a fullscreen **GIF** during the swap.

- Default variant is `gif`; with no GIF set it falls back to the circle reveal.
- Set your GIF via env — `NEXT_PUBLIC_THEME_GIF_URL` (see `.env.example`). Restart dev after changing
  (Next inlines `NEXT_PUBLIC_*`).

## Develop

```bash
cp .env.example .env.local       # NEXT_PUBLIC_API_URL=http://localhost:4000
pnpm install
pnpm dev                         # http://localhost:3000
```

Real `(account)` / `(admin)` data needs the backend running (see ../README.md). Without it those
pages sit on `LOADING…`.

> `/preview` is a dev-only styleguide route rendering every primitive — **delete before shipping**.

## Layout

`src/app/<route-group>` (thin pages) · `src/features/<feature>/{components,hooks,services,context}` ·
`src/components/ui` (design-system primitives) · `src/lib` · `src/types`.
