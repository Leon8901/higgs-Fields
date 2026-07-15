import { createContext, useContext, useEffect } from "react";
import { useGetPublicSettings } from "@workspace/api-client-react";
import type { PublicSettings } from "@workspace/api-client-react";

// The one place the frontend reads database-driven site configuration.
// Backed by GET /settings (public, isPublic=true keys only). Falls back to
// these exact hardcoded defaults — matching what was previously
// hardcoded in index.html/layout.tsx — while the first fetch is in flight,
// so there's no flash of empty chrome.
const FALLBACK_SETTINGS: PublicSettings = {
  site_name: "Higgsfield AI",
  site_tagline: "The premium AI platform for filmmakers, creators, and developers.",
  logo_url: "/logo.svg",
  favicon_url: "/favicon.svg",
  theme_color: "#CEFF00",
  maintenance_mode: false,
  maintenance_message: "We're performing scheduled maintenance. Please check back shortly.",
  registration_enabled: true,
  platform_generation_enabled: true,
  default_image_model_slug: "",
  default_video_model_slug: "",
  default_audio_model_slug: "",
  homepage_banner: { enabled: false, text: "" },
  announcement: { enabled: false, text: "" },
};

const SettingsContext = createContext<PublicSettings>(FALLBACK_SETTINGS);

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { data } = useGetPublicSettings();
  const settings = data ?? FALLBACK_SETTINGS;

  // Instant propagation for a client-only SPA (no SSR pipeline exists):
  // apply title/meta/favicon on every settings change, not just first
  // mount, so a PATCH made in another tab shows up here without a reload.
  useEffect(() => {
    document.title = settings.site_name;

    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) metaDescription.setAttribute("content", settings.site_tagline);
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute("content", settings.site_name);
    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription) ogDescription.setAttribute("content", settings.site_tagline);
    const twitterTitle = document.querySelector('meta[name="twitter:title"]');
    if (twitterTitle) twitterTitle.setAttribute("content", settings.site_name);
    const twitterDescription = document.querySelector('meta[name="twitter:description"]');
    if (twitterDescription) twitterDescription.setAttribute("content", settings.site_tagline);

    let favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.rel = "icon";
      document.head.appendChild(favicon);
    }
    favicon.href = settings.favicon_url.startsWith("/") ? `${basePath}${settings.favicon_url}` : settings.favicon_url;
  }, [settings.site_name, settings.site_tagline, settings.favicon_url]);

  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>;
}

export function useSiteSettings(): PublicSettings {
  return useContext(SettingsContext);
}

// Resolves a logo_url/favicon_url setting (always an owned "/..." storage
// path per the registry validator) against the artifact's base path.
export function resolveAssetUrl(path: string): string {
  return path.startsWith("/") ? `${basePath}${path}` : path;
}
