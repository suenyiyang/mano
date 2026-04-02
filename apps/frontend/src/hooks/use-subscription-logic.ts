import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient } from "../services/api-client.js";
import type { SubscriptionCurrentResponse, SubscriptionPlan } from "../types/api.js";

export const useSubscriptionLogic = () => {
  const plansQuery = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ plans: SubscriptionPlan[] }>("/subscriptions/plans");
      return data.plans;
    },
  });

  const currentQuery = useQuery({
    queryKey: ["subscription-current"],
    queryFn: async () => {
      const { data } = await apiClient.get<SubscriptionCurrentResponse>("/subscriptions/current");
      return data;
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (tier: string) => {
      const { data } = await apiClient.post<{ url: string }>("/subscriptions/checkout", { tier });
      return data.url;
    },
    onSuccess: (url) => {
      window.location.href = url;
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<{ url: string }>("/subscriptions/portal");
      return data.url;
    },
    onSuccess: (url) => {
      window.location.href = url;
    },
  });

  return {
    plans: plansQuery.data ?? [],
    current: currentQuery.data ?? null,
    isLoading: plansQuery.isLoading || currentQuery.isLoading,
    checkoutMutation,
    portalMutation,
  };
};
