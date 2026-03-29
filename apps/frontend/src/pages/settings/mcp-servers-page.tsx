import { Pencil, Plus, Power, Trash2 } from "lucide-react";
import { type FC, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/button.js";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog.js";
import { Input } from "../../components/ui/input.js";
import { useMcpServersLogic } from "../../hooks/use-mcp-servers-logic.js";
import type { McpServer } from "../../types/api.js";

type Transport = "stdio" | "sse" | "streamable-http";

interface McpFormState {
  name: string;
  transport: Transport;
  command: string;
  args: string;
  url: string;
}

const emptyForm: McpFormState = {
  name: "",
  transport: "stdio",
  command: "",
  args: "",
  url: "",
};

export const McpServersPage: FC = () => {
  const { t } = useTranslation();
  const { mcpServers, isLoading, createMutation, updateMutation, deleteMutation } =
    useMcpServersLogic();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<McpServer | null>(null);
  const [form, setForm] = useState<McpFormState>(emptyForm);

  const openCreate = () => {
    setEditingServer(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (server: McpServer) => {
    setEditingServer(server);
    setForm({
      name: server.name,
      transport: server.transport,
      command: server.command ?? "",
      args: server.args?.join(" ") ?? "",
      url: server.url ?? "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    const payload = {
      name: form.name,
      transport: form.transport,
      ...(form.transport === "stdio"
        ? { command: form.command, args: form.args ? form.args.split(" ") : undefined }
        : { url: form.url }),
    };

    if (editingServer) {
      updateMutation.mutate(
        { id: editingServer.id, ...payload },
        { onSuccess: () => setDialogOpen(false) },
      );
    } else {
      createMutation.mutate(payload, { onSuccess: () => setDialogOpen(false) });
    }
  };

  const handleToggle = (server: McpServer) => {
    updateMutation.mutate({ id: server.id, isEnabled: !server.isEnabled });
  };

  const handleDelete = (server: McpServer) => {
    deleteMutation.mutate(server.id);
  };

  if (isLoading) {
    return <p className="text-sm text-[var(--fg-muted)]">{t("mcpServers.loading")}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[var(--fg)]">{t("mcpServers.title")}</h2>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t("mcpServers.addServer")}
        </Button>
      </div>

      {mcpServers.length === 0 ? (
        <p className="text-sm text-[var(--fg-muted)]">{t("mcpServers.empty")}</p>
      ) : (
        <div className="space-y-2">
          {mcpServers.map((server) => (
            <div
              key={server.id}
              className="flex items-center justify-between rounded-[var(--radius-default)] border border-[var(--border)] px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--fg)]">{server.name}</span>
                  <span className="rounded bg-[var(--bg-hover)] px-1.5 py-0.5 text-xs text-[var(--fg-muted)]">
                    {server.transport}
                  </span>
                  {!server.isEnabled && (
                    <span className="text-xs text-[var(--fg-faint)]">{t("common.disabled")}</span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-[var(--fg-muted)] font-mono truncate">
                  {server.transport === "stdio" ? server.command : server.url}
                </p>
              </div>
              <div className="ml-3 flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => handleToggle(server)}>
                  <Power className={`h-4 w-4 ${server.isEnabled ? "text-green-500" : ""}`} />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => openEdit(server)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(server)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingServer ? t("mcpServers.editTitle") : t("mcpServers.createTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder={t("mcpServers.namePlaceholder")}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <select
              className="flex h-9 w-full rounded-[var(--radius-default)] border border-[var(--border-input)] bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--border)]"
              value={form.transport}
              onChange={(e) => setForm({ ...form, transport: e.target.value as Transport })}
            >
              <option value="stdio">stdio</option>
              <option value="sse">sse</option>
              <option value="streamable-http">streamable-http</option>
            </select>
            {form.transport === "stdio" ? (
              <>
                <Input
                  placeholder={t("mcpServers.commandPlaceholder")}
                  value={form.command}
                  onChange={(e) => setForm({ ...form, command: e.target.value })}
                />
                <Input
                  placeholder={t("mcpServers.argsPlaceholder")}
                  value={form.args}
                  onChange={(e) => setForm({ ...form, args: e.target.value })}
                />
              </>
            ) : (
              <Input
                placeholder={t("mcpServers.urlPlaceholder")}
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                !form.name ||
                (form.transport === "stdio" ? !form.command : !form.url) ||
                createMutation.isPending ||
                updateMutation.isPending
              }
            >
              {editingServer ? t("common.save") : t("common.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
