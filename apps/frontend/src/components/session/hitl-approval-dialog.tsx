import { type FC, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog.js";
import { Input } from "../ui/input.js";

interface HitlApprovalDialogProps {
  open: boolean;
  description: string;
  onApprove: () => void;
  onDeny: (reason?: string) => void;
  onClose: () => void;
}

export const HitlApprovalDialog: FC<HitlApprovalDialogProps> = (props) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");

  return (
    <Dialog open={props.open} onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("hitlDialog.title")}</DialogTitle>
          <DialogDescription>{props.description}</DialogDescription>
        </DialogHeader>

        <Input
          placeholder={t("hitlDialog.reasonPlaceholder")}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />

        <DialogFooter>
          <Button variant="ghost" onClick={() => props.onDeny(reason || undefined)}>
            {t("hitlDialog.deny")}
          </Button>
          <Button onClick={props.onApprove}>{t("hitlDialog.approve")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
