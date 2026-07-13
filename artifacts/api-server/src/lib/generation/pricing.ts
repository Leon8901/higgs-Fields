import type { Model } from "@workspace/db";

// Billing decision: "what do we charge for this generation?" — deliberately
// separate from ./keyRouting.ts's "which key do we use?" so routing and
// pricing rules can change independently (e.g. a future provider might want
// a reduced-but-nonzero BYOK fee instead of a flat waiver).
export function computeCreditsCharged(usedOwnKey: boolean, model: Pick<Model, "creditCost">): number {
  return usedOwnKey ? 0 : model.creditCost;
}
