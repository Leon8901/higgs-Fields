import { Link } from "wouter";
import { Show } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Key, ArrowRight, ShieldCheck, Zap } from "lucide-react";
import { AddYourKeysList } from "@/components/add-keys-panel";
import { useListProviders, useListApiKeys } from "@workspace/api-client-react";

function ConnectedCount() {
  const { data: providers } = useListProviders();
  const { data: keys } = useListApiKeys();
  const connected = (keys ?? []).length;
  const total = (providers ?? []).length;
  if (!total) return null;
  return (
    <div className="flex flex-wrap gap-3 mb-8">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.04] border border-white/8 rounded-xl text-sm">
        <ShieldCheck className="w-4 h-4 text-primary" />
        <span className="text-white/70">
          <span className="text-white font-semibold">{connected} of {total}</span> providers connected
        </span>
      </div>
      <div className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.04] border border-white/8 rounded-xl text-sm">
        <Key className="w-4 h-4 text-white/50" />
        <span className="text-white/70">Your keys are encrypted and secure</span>
      </div>
    </div>
  );
}

export default function ApiKeysPage() {
  return (
    <div className="container mx-auto px-4 py-16 min-h-screen max-w-5xl">
      <Show when="signed-out">
        <div className="flex flex-col items-center justify-center text-center gap-6 py-24">
          <h1 className="text-3xl md:text-4xl font-black text-white">Sign in to manage your API keys</h1>
          <Link href="/sign-in">
            <Button className="bg-primary text-black font-bold hover:bg-primary/90">Log in</Button>
          </Link>
        </div>
      </Show>

      <Show when="signed-in">
        <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-600 flex items-center justify-center shadow-lg shadow-pink-900/30">
                <Key className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-white">API Keys</h1>
            </div>
            <p className="text-muted-foreground text-sm max-w-lg">
              Bring your own provider API keys to generate without spending platform credits.
              We validate and encrypt every key before it's stored.
            </p>
          </div>
          <Link href="/image">
            <Button className="bg-primary text-black font-bold hover:bg-primary/90 shrink-0">
              Go to Generate <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </Link>
        </div>

        <ConnectedCount />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <AddYourKeysList />
          </div>

          <div className="space-y-4">
            <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-white text-sm">Your keys, your control</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                Use your own API keys to generate content. You'll be billed directly by the provider.
              </p>
              <ul className="space-y-2 text-xs text-white/60">
                {[
                  "No extra platform fees",
                  "Higher rate limits",
                  "Use your existing credits",
                  "100% secure & encrypted",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <Zap className="w-3 h-3 text-primary shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <a
                href="#"
                className="inline-flex items-center gap-1 mt-4 text-xs text-primary hover:text-primary/80 font-semibold transition-colors"
              >
                Learn more <ArrowRight className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
