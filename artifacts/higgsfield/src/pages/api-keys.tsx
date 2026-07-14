import { Link } from "wouter";
import { Show } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Key, ArrowRight, ShieldCheck, Zap, ExternalLink } from "lucide-react";
import { AddYourKeysList } from "@/components/add-keys-panel";
import { useListProviders, useListApiKeys } from "@workspace/api-client-react";

function InfoCard() {
  return (
    <div className="bg-[#141414] border border-white/[0.08] rounded-2xl p-5 flex flex-col gap-3 h-full">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
        <span className="font-bold text-white text-sm">Your keys, your control</span>
      </div>
      <p className="text-xs text-white/40 leading-relaxed">
        Use your own API keys to generate content. You'll be billed directly by the provider.
      </p>
      <ul className="space-y-2 mt-1">
        {[
          "No extra platform fees",
          "Higher rate limits",
          "Use your existing credits",
          "100% secure & encrypted",
        ].map((item) => (
          <li key={item} className="flex items-center gap-2 text-xs text-white/55">
            <Zap className="w-3 h-3 text-primary shrink-0" />
            {item}
          </li>
        ))}
      </ul>
      <Link
        href="/tools"
        className="inline-flex items-center gap-1 mt-auto text-xs text-white/35 hover:text-white/60 font-semibold transition-colors"
      >
        Explore models <ExternalLink className="w-3 h-3" />
      </Link>
    </div>
  );
}

function StatsBar() {
  const { data: providers } = useListProviders();
  const { data: keys } = useListApiKeys();
  const connected = (keys ?? []).length;
  const total = (providers ?? []).length;

  return (
    <div className="flex flex-wrap gap-3 mb-8">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm min-w-0">
        <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
        <span className="text-white/65 whitespace-nowrap">
          <span className="text-white font-semibold">{connected} of {total || "…"}</span> providers connected
        </span>
      </div>
      <div className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm">
        <Key className="w-4 h-4 text-white/40 shrink-0" />
        <span className="text-white/65 whitespace-nowrap">Your keys are encrypted and secure</span>
      </div>
    </div>
  );
}

export default function ApiKeysPage() {
  return (
    <div className="container mx-auto px-4 py-12 min-h-screen max-w-screen-xl">
      <Show when="signed-out">
        <div className="flex flex-col items-center justify-center text-center gap-6 py-24">
          <h1 className="text-3xl md:text-4xl font-black text-white">Sign in to manage your API keys</h1>
          <Link href="/sign-in">
            <Button className="bg-primary text-black font-bold hover:bg-primary/90">Log in</Button>
          </Link>
        </div>
      </Show>

      <Show when="signed-in">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Key className="w-7 h-7 text-primary shrink-0" />
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-white leading-none">API Keys</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Bring your own keys and unlock the full power of your favorite providers.
              </p>
            </div>
          </div>
          <Link href="/image">
            <Button className="bg-primary text-black font-bold hover:bg-primary/90 shrink-0">
              Go to Generate <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </Link>
        </div>

        <StatsBar />

        {/* 4-column grid — info card is the last cell */}
        <AddYourKeysList
          layout="grid"
          appendChildren={<InfoCard />}
        />
      </Show>
    </div>
  );
}
