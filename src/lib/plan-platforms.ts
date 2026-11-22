import { PLATFORMS, type Platform } from "@/types";

export function platformsForPlan(planType: string | null | undefined): Platform[] {
  const plan = (planType || "").toLowerCase();
  if (!plan || plan === "all" || plan.includes("all")) return [...PLATFORMS];
  if (plan.includes("amazon") || plan.includes("fba")) return ["amazon"];
  if (plan.includes("flipkart")) return ["flipkart"];
  if (plan.includes("meesho")) return ["meesho"];
  return [...PLATFORMS];
}
