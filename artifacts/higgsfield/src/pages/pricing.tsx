import {
  useListPricingPlans,
  getListPricingPlansQueryKey,
  useGetMe,
  useSwitchPlan,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "wouter";
import { Show } from "@clerk/react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

export default function Pricing() {
  const [isYearly, setIsYearly] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: plans, isLoading } = useListPricingPlans({
    query: { queryKey: getListPricingPlansQueryKey() }
  });
  const { data: me } = useGetMe();

  const switchPlan = useSwitchPlan({
    mutation: {
      onSuccess: (updated) => {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        toast({
          title: "Plan updated",
          description: `You're now on the ${updated.planKey} plan with ${updated.creditsBalance} credits.`,
        });
      },
      onError: () => toast({ title: "Couldn't switch plans", variant: "destructive" }),
    },
  });

  return (
    <div className="container mx-auto px-4 py-16 md:py-24 min-h-screen">
      <div className="text-center max-w-3xl mx-auto mb-16">
        <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight mb-6">
          Simple, transparent pricing
        </h1>
        <p className="text-xl text-muted-foreground mb-10">
          Start generating for free, upgrade when you need more power and studio-grade models.
        </p>
        
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
                        disabled={me?.planKey === plan.planKey || switchPlan.isPending}
                        onClick={() => switchPlan.mutate({ data: { planKey: plan.planKey } })}
                      >
                        {me?.planKey === plan.planKey
                          ? "Current plan"
                          : switchPlan.isPending
                            ? "Switching…"
                            : plan.ctaLabel}
                      </Button>
                    </Show>
                  </CardFooter>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
      
      <div className="mt-24 text-center border-t border-white/5 pt-16 max-w-3xl mx-auto">
        <h3 className="text-2xl font-bold text-white mb-4">Need an enterprise solution?</h3>
        <p className="text-muted-foreground mb-8">
          Custom SLA, dedicated account manager, private instances, and unlimited generations.
        </p>
        <Button variant="outline" className="border-white/10 text-white hover:bg-white/5">
          Contact Sales
        </Button>
      </div>
    </div>
  );
}
