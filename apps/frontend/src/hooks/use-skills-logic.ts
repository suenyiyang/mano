import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../services/api-client.js";
import type { CreateSkillPayload, Skill, UpdateSkillPayload } from "../types/api.js";

export const useSkillsLogic = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["skills"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ skills: Skill[] }>("/skills/list");
      return data.skills;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: CreateSkillPayload) => {
      const { data } = await apiClient.post<{ skill: Skill }>("/skills/create", payload);
      return data.skill;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...payload }: UpdateSkillPayload & { id: string }) => {
      const { data } = await apiClient.post<{ skill: Skill }>(`/skills/${id}/update`, payload);
      return data.skill;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.post(`/skills/${id}/delete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills"] });
    },
  });

  return {
    skills: query.data ?? [],
    isLoading: query.isLoading,
    createMutation,
    updateMutation,
    deleteMutation,
  };
};
