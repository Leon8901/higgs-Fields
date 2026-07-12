---
name: Studio pages use a viewport-locked Layout shell
description: Why /image, /video, /audio skip the Footer and use a fixed-height shell instead of a hardcoded vh-calc, and how to keep new full-screen studio routes consistent.
---

In `layout.tsx`, routes listed in `NO_FOOTER_PATHS` (`/image`, `/video`, `/audio`) render
without the `Footer` and the outer chrome switches from `min-h-[100dvh]` (normal
document scroll) to `h-[100dvh] overflow-hidden` with `main` as `flex-1 min-h-0
overflow-hidden`. The studio page itself (`category-studio.tsx`) then just uses
`h-full` and manages its own internal scroll regions.

**Why:** the studio page used to hardcode `h-[calc(100vh-4rem)]`, assuming only a
4rem Navbar sits above it. The dismissible `AnnouncementBanner` adds extra height
the calc didn't account for, so total chrome + fixed-height content exceeded the
viewport and produced an unwanted page-level scrollbar (and rendering the Footer
after it made this worse, since Footer added further height below the fixed-size
studio box). A relative `h-full` inside a genuinely bounded flex chain adapts
automatically if the banner is dismissed or changes height — a hardcoded calc does not.

**How to apply:** any new full-screen, app-like page (no footer, internally
scrolling) should be added to `NO_FOOTER_PATHS` and sized with `h-full`/`flex-1
min-h-0`, not a hardcoded `vh`-based calc. Ordinary content pages should keep using
the default `min-h-[100dvh]` shell so they scroll normally and show the Footer.
