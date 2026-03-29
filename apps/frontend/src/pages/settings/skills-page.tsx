import { Pencil, Plus, Power, Trash2 } from "lucide-react";
import { type FC, useState } from "react";
import { Button } from "../../components/ui/button.js";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog.js";
import { Input } from "../../components/ui/input.js";
import { useSkillsLogic } from "../../hooks/use-skills-logic.js";
import type { Skill } from "../../types/api.js";

interface SkillFormState {
  name: string;
  displayName: string;
  description: string;
  content: string;
}

const emptyForm: SkillFormState = {
  name: "",
  displayName: "",
  description: "",
  content: "",
};

export const SkillsPage: FC = () => {
  const { skills, isLoading, createMutation, updateMutation, deleteMutation } = useSkillsLogic();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [form, setForm] = useState<SkillFormState>(emptyForm);

  const openCreate = () => {
    setEditingSkill(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (skill: Skill) => {
    setEditingSkill(skill);
    setForm({
      name: skill.name,
      displayName: skill.displayName,
      description: skill.description,
      content: skill.content,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingSkill) {
      updateMutation.mutate(
        { id: editingSkill.id, ...form },
        { onSuccess: () => setDialogOpen(false) },
      );
    } else {
      createMutation.mutate(form, { onSuccess: () => setDialogOpen(false) });
    }
  };

  const handleToggle = (skill: Skill) => {
    updateMutation.mutate({ id: skill.id, isEnabled: !skill.isEnabled });
  };

  const handleDelete = (skill: Skill) => {
    deleteMutation.mutate(skill.id);
  };

  if (isLoading) {
    return <p className="text-sm text-[var(--fg-muted)]">Loading skills...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[var(--fg)]">Skills</h2>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add Skill
        </Button>
      </div>

      {skills.length === 0 ? (
        <p className="text-sm text-[var(--fg-muted)]">No skills configured yet.</p>
      ) : (
        <div className="space-y-2">
          {skills.map((skill) => (
            <div
              key={skill.id}
              className="flex items-center justify-between rounded-[var(--radius-default)] border border-[var(--border)] px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--fg)]">{skill.displayName}</span>
                  <span className="text-xs text-[var(--fg-faint)] font-mono">{skill.name}</span>
                  {!skill.isEnabled && (
                    <span className="text-xs text-[var(--fg-faint)]">disabled</span>
                  )}
                </div>
                {skill.description && (
                  <p className="mt-0.5 text-xs text-[var(--fg-muted)] truncate">
                    {skill.description}
                  </p>
                )}
              </div>
              <div className="ml-3 flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => handleToggle(skill)}>
                  <Power className={`h-4 w-4 ${skill.isEnabled ? "text-green-500" : ""}`} />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => openEdit(skill)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(skill)}>
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
            <DialogTitle>{editingSkill ? "Edit Skill" : "Create Skill"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Name (kebab-case)"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Input
              placeholder="Display Name"
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            />
            <Input
              placeholder="Description (optional)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <textarea
              className="flex min-h-[120px] w-full rounded-[var(--radius-default)] border border-[var(--border-input)] bg-transparent px-3 py-2 text-sm placeholder:text-[var(--fg-faint)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--border)]"
              placeholder="Skill content / prompt"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                !form.name ||
                !form.displayName ||
                !form.content ||
                createMutation.isPending ||
                updateMutation.isPending
              }
            >
              {editingSkill ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
