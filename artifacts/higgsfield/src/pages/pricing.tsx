import {
  useListPricingPlans,
  getListPricingPlansQueryKey,
  useListCreditPacks,
  getListCreditPacksQueryKey,
  useGetBillingStatus,
  useGetMe,
  useSwitchPlan,
  useSubscribe,
  usePurchaseCredits,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "wouter";
import { Show } from "@clerk/react";
import { Check, X, Info, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { openRazorpayCheckout } from "@/lib/razorpay";

// Any ApiError thrown by customFetch carries the real backend message at
// `.data.error` (parsed JSON body) or a pre-formatted "HTTP <status>: ..."
// string at `.message`. Never show a bare generic fallback — always surface
// what the server actually said (see tool-detail.tsx for the same pattern).
function extractErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object") {
    const data = (err as { data?: unknown }).data;
    if (data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string") {
      return (data as { error: string }).error;
    }
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

export default function Pricing() {
  const [isYearly, setIsYearly] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: plans, isLoading } = useListPricingPlans({
    query: { queryKey: getListPricingPlansQueryKey() },
  });
  const { data: creditPacks } = useListCreditPacks({
    query: { queryKey: getListCreditPacksQueryKey() },
  });
  const { data: billingStatus } = useGetBillingStatus();
  const { data: me } = useGetMe();

  const switchPlan = useSwitchPlan({
    mutation: {
      onSuccess: (updated) => {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        toast({ title: "Downgraded to Free", description: "Your subscription has been cancelled." });
      },
      onError: (err) =>
        toast({ title: "Couldn't switch plans", description: extractErrorMessage(err, "Please try again."), variant: "destructive" }),
    },
  });

  const subscribe = useSubscribe();
  const purchaseCredits = usePurchaseCredits();

  const [checkoutPending, setCheckoutPending] = useState<string | null>(null);

  const handleSubscribe = async (planKey: string) => {
    setCheckoutPending(planKey);
    try {
      const result = await subscribe.mutateAsync({ data: { planKey, interval: isYearly ? "yearly" : "monthly" } });
      await openRazorpayCheckout({
        keyId: result.razorpayKeyId,
        subscriptionId: result.subscriptionId,
        name: "Higgsfield AI",
        description: `${planKey} plan (${isYearly ? "yearly" : "monthly"})`,
        prefillEmail: me?.email,
        onSuccess: () => {
          toast({
            title: "Payment received",
            description: "Your subscription is activating — this can take a few seconds to reflect.",
          });
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        },
      });
    } catch (err) {
      toast({
        title: "Couldn't start checkout",
        description: extractErrorMessage(err, "Please try again later."),
        variant: "destructive",
      });
    } finally {
      setCheckoutPending(null);
    }
  };

  const handlePurchasePack = async (packKey: string) => {
    setCheckoutPending(packKey);
    try {
      const result = await purchaseCredits.mutateAsync({ data: { packKey } });
      await openRazorpayCheckout({
        keyId: result.razorpayKeyId,
        orderId: result.orderId,
        amount: result.amount,
        currency: "INR",
        name: "Higgsfield AI",
        description: "Credit top-up",
        prefillEmail: me?.email,
        onSuccess: () => {
          toast({ title: "Payment received", description: "Credits will appear on your account shortly." });
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        },
      });
    } catch (err) {
      toast({
        title: "Couldn't start checkout",
        description: extractErrorMessage(err, "Please try again later."),
        variant: "destructive",
      });
    } finally {
      setCheckoutPending(null);
    }
  };

  return (
    <div className="container mx-auto px-4 py-16 md:py-24 min-h-screen">
      <div className="text-center max-w-3xl mx-auto mb-16">
        <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter mb-6">
          Simple, transparent pricing
        </h1>
        <p className="text-xl text-muted-foreground mb-6">
          Start generating for free, upgrade when you need more power and studio-grade models.
        </p>

        {billingStatus && !billingStatus.configured && (
          <div className="inline-flex items-center gap-2 text-xs text-white/50 bg-white/5 border border-white/10 rounded-full px-4 py-2 mb-4">
            <Info className="w-3.5 h-3.5 shrink-0" />
            Payments aren't fully switched on yet — you can preview checkout, but charges won't go through until billing is finished setting up.
          </div>
        )}

        <div className="flex items-center justify-center gap-4">
          <Label htmlFor="billing-toggle" className={`text-sm ${!isYearly ? 'text-white' : 'text-muted-foreground'}`}>
            Monthly
          </Label>
          <Switch
            id="billing-toggle"
            checked={isYearly}
            onCheckedChange={setIsYearly}
            className="data-[state=checked]:bg-primary"
          />
          <Label htmlFor="billing-toggle" className={`text-sm flex items-center gap-2 ${isYearly ? 'text-white' : 'text-muted-foreground'}`}>
            Yearly <span className="bg-primary/20 text-primary text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">Save 20%</span>
          </Label>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {[1, 2, 3].map(i => (
            <Card key={i} className="bg-white/5 border-white/10 h-[600px] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans?.map((plan, i) => {
            const price = isYearly ? plan.yearlyPrice : plan.price;
            const isCurrent = me?.planKey === plan.planKey && me?.subscriptionStatus === "active";
            const isPending = checkoutPending === plan.planKey;

            return (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                key={plan.id}
                className={plan.isPopular ? "md:-mt-8 md:mb-8" : ""}
              >
                <Card className={`h-full flex flex-col relative overflow-hidden ${
                  plan.isPopular
                    ? 'bg-black border-primary/50 shadow-[0_0_40px_rgba(206,255,0,0.15)]'
                    : 'bg-black/40 border-white/10 hover:border-white/20'
                }`}>
                  {plan.isPopular && (
                    <div className="absolute top-0 inset-x-0 h-1 bg-primary" />
                  )}

                  <CardHeader className="p-8 pb-4">
                    {plan.isPopular && (
                      <div className="text-primary text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        Most Popular
                      </div>
                    )}
                    <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                    <p className="text-muted-foreground text-sm min-h-[40px]">{plan.description}</p>
                  </CardHeader>

                  <CardContent className="p-8 pt-0 flex-1">
                    <div className="mb-8">
                      <span className="text-5xl font-black text-white">${price}</span>
                      {price > 0 && <span className="text-muted-foreground ml-2">/ month</span>}
                    </div>

                    <ul className="space-y-4">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <Check className={`w-5 h-5 shrink-0 ${plan.isPopular ? 'text-primary' : 'text-white/40'}`} />
                          <span className="text-sm text-white/80">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>

                  <CardFooter className="p-8 pt-0">
                    <Show when="signed-out">
                      <Link href="/sign-up" className="w-full">
                        <Button
                          variant={plan.isPopular ? "lime" : "outline"}
                          className={`w-full h-12 text-base ${!plan.isPopular && 'border-white/10 text-white hover:bg-white/5'}`}
                        >
                          {plan.ctaLabel}
                        </Button>
                      </Link>
                    </Show>
                    <Show when="signed-in">
                      <Button
                        variant={plan.isPopular ? "lime" : "outline"}
                        className={`w-full h-12 text-base ${!plan.isPopular && 'border-white/10 text-white hover:bg-white/5'}`}
                        disabled={isCurrent || isPending}
                        onClick={() => handleSubscribe(plan.planKey)}
                      >
                        {isCurrent ? "Current plan" : isPending ? "Opening checkout…" : plan.ctaLabel}
                      </Button>
                    </Show>
                  </CardFooter>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <Show when="signed-in">
        {me && me.planKey !== "free" && me.subscriptionStatus === "active" && (
          <div className="max-w-6xl mx-auto mt-8 text-center">
            <Button
              variant="ghost"
              className="text-white/40 hover:text-white text-sm"
              disabled={switchPlan.isPending}
              onClick={() => switchPlan.mutate({ data: { planKey: "free" } })}
            >
              {switchPlan.isPending ? "Cancelling…" : "Cancel subscription and downgrade to Free"}
            </Button>
          </div>
        )}
      </Show>

      {creditPacks && creditPacks.length > 0 && (
        <div className="max-w-6xl mx-auto mt-24 border-t border-white/5 pt-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-black text-white mb-3 tracking-tight">Need credits without a subscription?</h2>
            <p className="text-muted-foreground">One-time credit top-ups — no recurring billing, use them whenever.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {creditPacks.map((pack) => {
              const isPending = checkoutPending === pack.packKey;
              return (
                <Card
                  key={pack.id}
                  className={`bg-black/40 border-white/10 ${pack.isPopular ? "border-primary/40" : ""}`}
                >
                  <CardContent className="p-6 flex flex-col items-center text-center gap-3">
                    {pack.isPopular && (
                      <span className="bg-primary/20 text-primary text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">
                        Best value
                      </span>
                    )}
                    <Coins className="w-6 h-6 text-primary" />
                    <h3 className="text-xl font-bold text-white">{pack.name}</h3>
                    <p className="text-3xl font-black text-white">{pack.credits.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">credits</span></p>
                    <p className="text-muted-foreground">${pack.priceUsd}</p>
                  </CardContent>
                  <CardFooter className="p-6 pt-0">
                    <Show when="signed-out">
                      <Link href="/sign-up" className="w-full">
                        <Button variant="outline" className="w-full border-white/10 text-white hover:bg-white/5">
                          Sign up to buy
                        </Button>
                      </Link>
                    </Show>
                    <Show when="signed-in">
                      <Button
                        variant="outline"
                        className="w-full border-white/10 text-white hover:bg-white/5"
                        disabled={isPending}
                        onClick={() => handlePurchasePack(pack.packKey)}
                      >
                        {isPending ? "Opening checkout…" : "Buy now"}
                      </Button>
                    </Show>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-24 text-center border-t border-white/5 pt-16 max-w-3xl mx-auto">
        <h3 className="text-2xl font-black text-white mb-4 tracking-tight">Need an enterprise solution?</h3>
        <p className="text-muted-foreground mb-8">
          Custom SLA, dedicated account manager, private instances, and unlimited generations.
        </p>
        <Button variant="outline" className="border-white/10 text-white hover:bg-white/5" asChild>
          <a href="mailto:support@higgsfield.ai">Contact Sales</a>
        </Button>
      </div>
    </div>
  );
}
