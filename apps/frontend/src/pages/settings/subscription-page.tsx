import { Check, CreditCard, ExternalLink, Loader2 } from "lucide-react";
import type { FC } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/button.js";
import { useSubscriptionLogic } from "../../hooks/use-subscription-logic.js";
import { cn } from "../../lib/utils.js";
import type { SubscriptionPlan } from "../../types/api.js";

const TIER_ORDER = ["free", "pro", "max"];

const formatDate = (iso: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const SubscriptionPage: FC = () => {
  const { t } = useTranslation();
  const { plans, current, isLoading, checkoutMutation, portalMutation } = useSubscriptionLogic();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-[var(--fg-muted)]">
        <Loader2 size={14} className="animate-spin" />
        {t("subscription.loading")}
      </div>
    );
  }

  const currentTier = current?.tier ?? "free";
  const credits = current?.credits;
  const subscription = current?.subscription;
  const sortedPlans = [...plans].sort(
    (a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier),
  );

  const creditPercent = credits
    ? Math.round((credits.balance / Math.max(credits.monthlyAllowance, 1)) * 100)
    : 0;

  const handleUpgrade = (tier: string) => {
    checkoutMutation.mutate(tier);
  };

  const handleManageBilling = () => {
    portalMutation.mutate();
  };

  return (
    <div className="space-y-6">
      {/* Current plan summary */}
      <div className="rounded-lg border border-[var(--border)] p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[var(--fg)]">
                {t("subscription.currentPlan")}
              </span>
              <span className="rounded-full bg-[var(--bg-hover)] px-2 py-0.5 text-xs font-medium text-[var(--fg)]">
                {currentTier.charAt(0).toUpperCase() + currentTier.slice(1)}
              </span>
              {subscription && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs",
                    subscription.status === "active"
                      ? "bg-emerald-500/10 text-emerald-500"
                      : "bg-amber-500/10 text-amber-500",
                  )}
                >
                  {subscription.status === "active"
                    ? t("subscription.active")
                    : subscription.status}
                </span>
              )}
            </div>
            {subscription?.cancelAtPeriodEnd && (
              <p className="mt-1 text-xs text-amber-500">{t("subscription.cancelsAt")}</p>
            )}
          </div>
          {currentTier !== "free" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleManageBilling}
              disabled={portalMutation.isPending}
            >
              <CreditCard size={14} />
              {t("subscription.manageBilling")}
              <ExternalLink size={12} />
            </Button>
          )}
        </div>

        {/* Credits bar */}
        {credits && (
          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-xs text-[var(--fg-muted)]">
              <span>{t("subscription.credits")}</span>
              <span>
                {credits.balance.toLocaleString()} / {credits.monthlyAllowance.toLocaleString()}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-hover)]">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  creditPercent > 20 ? "bg-emerald-500" : "bg-amber-500",
                )}
                style={{ width: `${Math.min(creditPercent, 100)}%` }}
              />
            </div>
            {subscription?.currentPeriodEnd && (
              <p className="mt-1 text-xs text-[var(--fg-muted)]">
                {t("subscription.resetsOn")} {formatDate(subscription.currentPeriodEnd)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-3 gap-3">
        {sortedPlans.map((plan) => (
          <PlanCard
            key={plan.tier}
            plan={plan}
            isCurrent={plan.tier === currentTier}
            currentTier={currentTier}
            onUpgrade={handleUpgrade}
            isLoading={checkoutMutation.isPending}
          />
        ))}
      </div>

      {/* Recent transactions */}
      {current?.recentTransactions && current.recentTransactions.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-[var(--fg)]">
            {t("subscription.recentUsage")}
          </h3>
          <div className="space-y-1">
            {current.recentTransactions.slice(0, 10).map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-xs text-[var(--fg-muted)]"
              >
                <span className="truncate">{tx.description ?? tx.type}</span>
                <span
                  className={cn(
                    "shrink-0 font-mono",
                    tx.amount < 0 ? "text-[var(--fg-muted)]" : "text-emerald-500",
                  )}
                >
                  {tx.amount > 0 ? "+" : ""}
                  {tx.amount}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Plan Card ──────────────────────────────────────────────────────────────

interface PlanCardProps {
  plan: SubscriptionPlan;
  isCurrent: boolean;
  currentTier: string;
  onUpgrade: (tier: string) => void;
  isLoading: boolean;
}

const PlanCard: FC<PlanCardProps> = (props) => {
  const { t } = useTranslation();
  const tierIndex = TIER_ORDER.indexOf(props.plan.tier);
  const currentIndex = TIER_ORDER.indexOf(props.currentTier);
  const isUpgrade = tierIndex > currentIndex;
  const isDowngrade = tierIndex < currentIndex;

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border p-4",
        props.isCurrent
          ? "border-[var(--fg)] bg-[var(--bg-hover)]"
          : "border-[var(--border)] bg-[var(--bg)]",
      )}
    >
      <div className="mb-1 text-sm font-medium text-[var(--fg)]">{props.plan.name}</div>
      <div className="mb-3 text-lg font-semibold text-[var(--fg)]">
        {props.plan.priceMonthly === 0 ? (
          t("subscription.free")
        ) : (
          <>
            ${props.plan.priceMonthly}
            <span className="text-xs font-normal text-[var(--fg-muted)]">
              {t("subscription.perMonth")}
            </span>
          </>
        )}
      </div>

      <div className="mb-3 text-xs text-[var(--fg-muted)]">
        {props.plan.creditAllowance.toLocaleString()} {t("subscription.creditsPerMonth")}
      </div>

      <div className="mb-4 flex-1 space-y-1">
        {props.plan.models.map((model) => (
          <div
            key={`${model.provider}-${model.apiModelId}`}
            className="flex items-center gap-1.5 text-xs text-[var(--fg-muted)]"
          >
            <Check size={12} className="shrink-0 text-emerald-500" />
            {model.displayName}
          </div>
        ))}
      </div>

      {props.isCurrent ? (
        <Button variant="outline" size="sm" disabled>
          {t("subscription.currentPlanButton")}
        </Button>
      ) : isUpgrade ? (
        <Button
          size="sm"
          onClick={() => props.onUpgrade(props.plan.tier)}
          disabled={props.isLoading || props.plan.tier === "free"}
        >
          {props.isLoading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            t("subscription.upgrade")
          )}
        </Button>
      ) : isDowngrade ? (
        <Button variant="outline" size="sm" disabled>
          {t("subscription.downgrade")}
        </Button>
      ) : null}
    </div>
  );
};
