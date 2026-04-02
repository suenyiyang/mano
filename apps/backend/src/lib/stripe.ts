import Stripe from "stripe";
import { getEnv } from "../env.js";

let cachedStripe: Stripe | undefined;

export const getStripe = (): Stripe => {
  if (!cachedStripe) {
    const key = getEnv().STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    cachedStripe = new Stripe(key);
  }
  return cachedStripe;
};

export const TIER_PRICE_MAP: Record<string, () => string | undefined> = {
  pro: () => getEnv().STRIPE_PRO_PRICE_ID,
  max: () => getEnv().STRIPE_MAX_PRICE_ID,
};

export const PRICE_TIER_MAP = (): Record<string, string> => {
  const env = getEnv();
  const map: Record<string, string> = {};
  if (env.STRIPE_PRO_PRICE_ID) map[env.STRIPE_PRO_PRICE_ID] = "pro";
  if (env.STRIPE_MAX_PRICE_ID) map[env.STRIPE_MAX_PRICE_ID] = "max";
  return map;
};
