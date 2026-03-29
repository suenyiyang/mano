import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../services/api-client.js";
import type { CreateMcpServerPayload, McpServer, UpdateMcpServerPayload } from "../types/api.js";

export const useMcpServersLogic = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["mcpServers"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ mcpServers: McpServer[] }>("/mcp-servers/list");
      return data.mcpServers;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: CreateMcpServerPayload) => {
      const { data } = await apiClient.post<{ mcpServer: McpServer }>(
        "/mcp-servers/create",
        payload,
      );
      return data.mcpServer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcpServers"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...payload }: UpdateMcpServerPayload & { id: string }) => {
      const { data } = await apiClient.post<{ mcpServer: McpServer }>(
        `/mcp-servers/${id}/update`,
        payload,
      );
      return data.mcpServer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcpServers"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.post(`/mcp-servers/${id}/delete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcpServers"] });
    },
  });

  return {
    mcpServers: query.data ?? [],
    isLoading: query.isLoading,
    createMutation,
    updateMutation,
    deleteMutation,
  };
};
