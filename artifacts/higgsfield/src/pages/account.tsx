import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Show, useUser } from "@clerk/react";
import { useGetMe, useListCreditLedger, useListPricingPlans, useListGenerations } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Zap, CreditCard, BarChart3, Key } from "lucide-react";
import { AddYourKeysModal } from "@/components/add-keys-panel";

function BYOKSection() {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-1">
        <Key className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold text-white">Add Your Keys</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Add your own provider API keys to generate without spending platform credits.
      </p>
      <Button className="bg-primary text-black font-bold hover:bg-primary/90" onClick={() => setOpen(true)}>
        <Key className="w-4 h-4 mr-2" /> Manage keys
      </Button>
      <AddYourKeysModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function UsageStatsSection() {
  const { data: generations, isLoading } = useListGenerations();

  const stats = useMemo(() => {
    if (!generations) return null;
    const byModel = new Map<string, { modelName: string; count: number; credits: number }>();
    let totalCredits = 0;
    let completed = 0;
    let failed = 0;
    for (const gen of generations) {
      totalCredits += gen.creditsCharged;
      if (gen.status === "completed") completed++;
      if (gen.status === "failed") failed++;
      const entry = byModel.get(gen.modelId) ?? { modelName: gen.modelName, count: 0, credits: 0 };
      entry.count += 1;
      entry.credits += gen.creditsCharged;
      byModel.set(gen.modelId, entry);
    }
    const models = [...byModel.values()].sort((a, b) => b.count - a.count);
    return { total: generations.length, completed, failed, totalCredits, models };
  }, [generations]);

  return (
    <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-5">
        <BarChart3 className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold text-white">Usage stats</h2>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 bg-white/5 rounded-lg" />)}
        </div>
      ) : !stats || stats.total === 0 ? (
        <p className="text-sm text-muted-foreground">No generations yet — your usage will show up here.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-white/[0.04] rounded-xl p-3 text-center">
              <div className="text-2xl font-black text-white">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Generations</div>
            </div>
            <div className="bg-white/[0.04] rounded-xl p-3 text-center">
              <div className="text-2xl font-black text-primary">{stats.totalCredits}</div>
              <div className="text-xs text-muted-foreground">Credits spent</div>
            </div>
            <div className="bg-white/[0.04] rounded-xl p-3 text-center">
              <div className="text-2xl font-black text-white">
                {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
              </div>
              <div className="text-xs text-muted-foreground">Success rate</div>
            </div>
          </div>

          <div className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">By model</div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {stats.models.map((m) => (
              <div key={m.modelName} className="flex items-center justify-between text-sm">
                <span className="text-white/80">{m.modelName}</span>
                <span className="text-muted-foreground">
                  {m.count} {m.count === 1 ? "run" : "runs"} · {m.credits} credits
                </span>
              </div>
            ))}
          </div>
        </>
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
          <UsageStatsSection />
          <LedgerSection />
        </div>
      </Show>
    </div>
  );
}
