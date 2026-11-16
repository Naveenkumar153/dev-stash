# Homepage

## Overview

Replace the placeholder `src/app/page.tsx` with the real marketing homepage, rebuilt from the static mockup in `prototypes/homepage/` (`index.html`, `styles.css`, `script.js`) using the app's stack. Match the mockup's layout, copy and motion; the prototype folder stays as the reference.

## Requirements

- Sections in mockup order: fixed nav, hero ("Stop Losing Your Developer Knowledge" + chaos → arrow → dashboard preview), Features (6 cards), AI (Pro badge, checklist, code editor mockup with AI tags), Pricing (Free / Pro with monthly / yearly toggle), CTA, footer
- Server components by default; `'use client'` only for the interactive pieces:
  - Nav background that grows more opaque on scroll
  - Chaos icons animation (`requestAnimationFrame` drift, wall bounce, rotation / scale pulse, push away from the cursor; paused off screen and when the tab is hidden)
  - Dashboard preview's looping "debounce" search demo
  - Pricing monthly / yearly toggle (Pro: $8/mo, or $6/mo billed $72/year)
  - Fade-in on scroll (one reusable `Reveal` wrapper on `IntersectionObserver`)
- Tailwind v4 + shadcn/ui like the rest of the app: `Button` / `buttonVariants`, `Card`, `Badge`, `Switch`; no `styles.css` port, no inline styles; keyframes or utilities that Tailwind lacks go in `src/app/globals.css`
- Respect `prefers-reduced-motion`: no drift, arrow pulse, preview demo or fade-ins (`motion-safe:` / `motion-reduce:` and a `matchMedia` check in the client pieces)
- Responsive: hero stacks on mobile with the arrow rotated to point down, every grid collapses to one column, no horizontal scroll at 390px

## Links

| Element | Signed out | Signed in |
| --- | --- | --- |
| Logo | `/` | `/` |
| Features / Pricing (nav, footer), See Features | `#features` / `#pricing` | same |
| Nav: Sign In | `/sign-in` | hidden |
| Nav: Get Started | `/register` | "Dashboard" → `/dashboard` |
| Hero "Get Started Free", Free plan, CTA | `/register` | `/dashboard` |
| Pro "Upgrade to Pro" | `/register` | `/dashboard` (billing is a later feature) |

- Read the session once in the page with `auth()` and pass the destinations down; don't call `auth()` in each section
- Footer: drop the mockup's placeholder links (Changelog, Documentation, API, Blog, About, Privacy, Terms) since those pages don't exist; keep Product (Features, Pricing) and Account (Sign In, Register / Dashboard) columns and the copyright year

## Structure

- `src/app/page.tsx` — server; loads the session, composes the sections, sets metadata
- `src/components/home/` — one file per section (`HomeNav`, `Hero`, `ChaosVisual`, `DashboardPreview`, `FeaturesSection`, `AiSection`, `PricingSection`, `CtaSection`, `HomeFooter`) plus the small client islands (`NavScrollShell`, `ChaosIcons`, `PreviewSearchDemo`, `BillingToggle`, `Reveal`)
- Static content as typed data arrays (features, AI checklist, plan features, footer columns, chaos icons) in `src/lib/homepage.ts`, mapped in JSX rather than repeated markup
- Pure pricing / motion helpers (price for billing period, wall bounce and cursor push math) in `src/lib/` with unit tests; the React pieces themselves are verified in the browser

## Keep It DRY

- Extract the DevStash logo (the `Layers` tile + wordmark, now duplicated in `src/app/(auth)/layout.tsx` and `SidebarBody`) into one shared `Logo` component and use it in all three places
- Feature cards and preview cards take their icon and color from `getItemTypeStyleByName()` / the `--color-type-*` tokens, so the homepage uses the app's type colors (not the prototype's separate palette)
- Reuse the inline GitHub mark from `GitHubSignInButton` (extract it to a shared icon) for the chaos visual; Notion, Slack and VS Code stay simple inline SVG marks, no external assets
- One section header component (eyebrow, gradient title, subtitle) and one gradient-text class shared across sections

## Out of Scope

- Stripe / real billing; the Pro button only routes
- Light mode
- Changes to `/sign-in`, `/register` or the dashboard beyond the shared `Logo`
- Deleting `prototypes/homepage/`
