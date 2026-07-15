---
name: App.tsx provider ordering bug (QueryClientProvider vs SettingsProvider)
description: Fix for "No QueryClient set" crash caused by a react-query hook running above QueryClientProvider in the provider tree.
---

In this project's `artifacts/higgsfield/src/App.tsx`, `SettingsProvider` (from `src/lib/settings.tsx`) calls `useGetPublicSettings()`, a react-query hook, and `SettingsProvider` wraps `ClerkProviderWithRoutes`. `QueryClientProvider` was originally mounted *inside* `ClerkProviderWithRoutes`, i.e. below `SettingsProvider` in the tree — so `SettingsProvider` rendered with no `QueryClient` in context and crashed with "No QueryClient set, use QueryClientProvider to set one".

**Why:** Easy to introduce when adding a new top-level provider (like `SettingsProvider`) around an existing `ClerkProviderWithRoutes` that already owned its own `QueryClientProvider` — nothing type-checks the provider order, so it only surfaces at runtime.

**How to apply:** `QueryClientProvider` must wrap every component that uses a react-query hook. In this codebase specifically, `QueryClientProvider` now wraps the whole `App()` tree (outside `WouterRouter`/`SettingsProvider`), not just `ClerkProviderWithRoutes`. If you see "No QueryClient set" here or in similarly-structured apps, check provider nesting order first before assuming a hook or import is broken.
