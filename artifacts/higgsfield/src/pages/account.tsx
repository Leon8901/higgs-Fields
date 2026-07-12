import { useState } from "react";
import { Link } from "wouter";
import { Show, useUser } from "@clerk/react";
import {
  useGetMe,
  useListCreditLedger,
  useListApiKeys,
  useUpsertApiKey,
  useDeleteApiKey,
  useListPricingPlans,
  getListApiKeysQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Zap, Key, Trash2, Plus, Eye, EyeOff, CreditCard } from "lucide-react";

function BYOKSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: keys, isLoading } = useListApiKeys();
  const [newKey, setNewKey] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [reveal, setReveal] = useState(false);

  const upsert = useUpsertApiKey({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListApiKeysQueryKey() });
        setNewKey("");
        setShowInput(false);
        toast({ title: "API key saved", description: "Your WaveSpeed key is now active for this account." });
      },
      onError: () => toast({ title: "Failed to save key", variant: "destructive" }),
    },
  });

  const del = useDeleteApiKey({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListApiKeysQueryKey() });
        toast({ title: "API key removed" });
      },
    },
  });

  const wavespeedKey = keys?.find((k) => k.provider === "wavespeed");

  return (
    <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-1">
        <Key className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold text-white">Bring Your Own Key</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Add your own WaveSpeed AI API key to generate without spending platform credits.
      </p>

      {isLoading ? (
        <Skeleton className="h-14 bg-white/5 rounded-xl" />
      ) : wavespeedKey ? (
        <div className="flex items-center justify-between bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-white">WaveSpeed AI</div>
            <div className="text-xs text-muted-foreground">
              {reveal ? `wsp_••••••••${wavespeedKey.lastFour}` : "•••• •••• •••• " + wavespeedKey.lastFour}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="text-white/50 hover:text-white" onClick={() => setReveal((r) => !r)}>
              {reveal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-red-400 hover:text-red-300"
              onClick={() => del.mutate({ provider: "wavespeed" })}
              disabled={del.isPending}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ) : showInput ? (
        <div className="flex flex-col gap-3">
          <Input
            type="password"
            placeholder="Paste your WaveSpeed API key"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            className="bg-white/[0.04] border-white/10 text-white"
          />
          <div className="flex gap-2">
            <Button
              className="bg-primary text-black font-bold hover:bg-primary/90"
              disabled={!newKey.trim() || upsert.isPending}
              onClick={() => upsert.mutate({ data: { provider: "wavespeed", apiKey: newKey.trim() } })}
            >
              {upsert.isPending ? "Saving…" : "Save key"}
            </Button>
            <Button variant="ghost" className="text-muted-foreground" onClick={() => setShowInput(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" className="border-white/15 text-white hover:bg-white/5" onClick={() => setShowInput(true)}>
          <Plus className="w-4 h-4 mr-1.5" /> Add WaveSpeed key
        </Button>
      )}
    </div>
  );
}

function LedgerSection() {
  const { data: ledger, isLoading } = useListCreditLedger();

  return (
    <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-5">
        <CreditCard className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold text-white">Credit history</h2>
      </div>
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 bg-white/5 rounded-lg" />)}
        </div>
      ) : !ledger || ledger.length === 0 ? (
        <p className="text-sm text-muted-foreground">No credit activity yet.</p>
      ) : (
        <div className="divide-y divide-white/5 max-h-96 overflow-y-auto">
          {ledger.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between py-3 text-sm">
              <div>
                <div className="text-white/90 capitalize">{entry.reason.replace(/_/g, " ")}</div>
                <div className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</div>
              </div>
              <div className={`font-bold ${entry.delta >= 0 ? "text-primary" : "text-white/70"}`}>
                {entry.delta >= 0 ? "+" : ""}
                {entry.delta}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Account() {
  const { user } = useUser();
  const { data: me } = useGetMe();
  const { data: plans } = useListPricingPlans();
  const currentPlan = plans?.find((p) => p.planKey === me?.planKey);

  return (
    <div className="container mx-auto px-4 py-16 min-h-screen max-w-3xl">
      <Show when="signed-out">
        <div className="flex flex-col items-center justify-center text-center gap-6 py-24">
          <h1 className="text-3xl md:text-4xl font-black text-white">Sign in to view your account</h1>
          <Link href="/sign-in">
            <Button className="bg-primary text-black font-bold hover:bg-primary/90">Log in</Button>
          </Link>
        </div>
      </Show>

      <Show when="signed-in">
        <div className="mb-10 flex items-center gap-4">
          {user?.imageUrl && (
            <img src={user.imageUrl} alt="" className="w-16 h-16 rounded-full border border-white/15 object-cover" />
          )}
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white">
              {user?.fullName || user?.primaryEmailAddress?.emailAddress}
            </h1>
            <p className="text-muted-foreground text-sm">{user?.primaryEmailAddress?.emailAddress}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="bg-primary/10 border border-primary/25 rounded-2xl p-5">
            <div className="flex items-center gap-2 text-primary text-sm font-semibold mb-1">
              <Zap className="w-4 h-4" /> Credits
            </div>
            <div className="text-3xl font-black text-white">{me?.creditsBalance ?? 0}</div>
          </div>
          <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-white/60 text-sm font-semibold">Current plan</span>
              <Badge variant="outline" className="border-white/20 text-white/80 capitalize">
                {me?.planKey ?? "free"}
              </Badge>
            </div>
            <div className="text-white/80 text-sm">
              {currentPlan ? `${currentPlan.creditsPerMonth} credits / month` : "50 free credits to start"}
            </div>
            <Link href="/pricing">
              <Button variant="link" className="text-primary px-0 h-auto mt-1">
                Manage plan →
              </Button>
            </Link>
          </div>
        </div>

        <div className="space-y-6">
          <BYOKSection />
          <LedgerSection />
        </div>
      </Show>
    </div>
  );
}
