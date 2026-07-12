import { useEffect, useRef } from "react";
import { Layout } from "@/components/layout";
import { Route, Switch, useLocation, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClerkProvider, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import Home from "@/pages/home";
import Tools from "@/pages/tools";
import ToolDetail from "@/pages/tool-detail";
import CategoryStudio from "@/pages/category-studio";

function ImageStudio() {
  return <CategoryStudio category="image" />;
}
function VideoStudio() {
  return <CategoryStudio category="video" />;
}
function AudioStudio() {
  return <CategoryStudio category="audio" />;
}
import MarketingStudio from "@/pages/marketing-studio";
import Presets from "@/pages/presets";
import Shorts from "@/pages/shorts";
import Apps from "@/pages/apps";
import Pricing from "@/pages/pricing";
import Library from "@/pages/library";
import Account from "@/pages/account";
import SignInPage from "@/pages/sign-in";
import SignUpPage from "@/pages/sign-up";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

// REQUIRED — copy verbatim. Resolves the key from window.location.hostname so the
// same build serves multiple Clerk custom domains. Do not inline the env var, leave
// publishableKey undefined, or replace publishableKeyFromHost with anything else.
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

// REQUIRED — copy verbatim. Empty in dev (Clerk hits dev FAPI directly), auto-set
// in prod. Do NOT gate on import.meta.env.PROD / NODE_ENV — the empty dev value
// is intentional, and any branching breaks the prod proxy.
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// Clerk passes full paths to routerPush/routerReplace, but wouter's
// setLocation prepends the base — strip it to avoid doubling.
function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env file");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#CEFF00",
    colorForeground: "#F5F5F5",
    colorMutedForeground: "#A6A6A6",
    colorDanger: "#EF4444",
    colorBackground: "#111111",
    colorInput: "#1C1C1C",
    colorInputForeground: "#F5F5F5",
    colorNeutral: "#2E2E2E",
    fontFamily: "'Inter', sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#111111] border border-white/10 rounded-2xl w-[440px] max-w-full overflow-hidden shadow-2xl",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-white text-2xl font-black",
    headerSubtitle: "text-white/60",
    socialButtonsBlockButtonText: "text-white font-medium",
    formFieldLabel: "text-white/80",
    footerActionLink: "text-primary hover:text-primary/80 font-semibold",
    footerActionText: "text-white/50",
    dividerText: "text-white/40",
    identityPreviewEditButton: "text-primary",
    formFieldSuccessText: "text-primary",
    alertText: "text-red-400",
    logoBox: "flex justify-center py-2",
    logoImage: "h-8",
    socialButtonsBlockButton: "border-white/15 bg-white/[0.03] hover:bg-white/[0.08]",
    formButtonPrimary: "bg-primary text-black font-bold hover:bg-primary/90 shadow-[0_0_20px_rgba(206,255,0,0.25)]",
    formFieldInput: "bg-[#1C1C1C] border-white/10 text-white",
    footerAction: "border-t border-white/5 pt-4",
    dividerLine: "bg-white/10",
    alert: "bg-red-500/10 border border-red-500/30",
    otpCodeFieldInput: "bg-[#1C1C1C] border-white/10 text-white",
    formFieldRow: "gap-3",
    main: "gap-5",
  },
};

// Helps user's webview stay up-to-date when the signed-in user changes by invalidating the QueryClient cache.
function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/tools" component={Tools} />
      <Route path="/tools/:slug" component={ToolDetail} />
      <Route path="/image" component={ImageStudio} />
      <Route path="/video" component={VideoStudio} />
      <Route path="/audio" component={AudioStudio} />
      <Route path="/marketing-studio" component={MarketingStudio} />
      <Route path="/presets" component={Presets} />
      <Route path="/shorts" component={Shorts} />
      <Route path="/apps" component={Apps} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/library" component={Library} />
      <Route path="/account" component={Account} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to keep creating with Higgsfield",
          },
        },
        signUp: {
          start: {
            title: "Create your account",
            subtitle: "Get 50 free credits to start generating",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Layout>
            <Router />
          </Layout>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
