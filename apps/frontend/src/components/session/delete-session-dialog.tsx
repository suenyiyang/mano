import type { FC } from "react";
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

interface DeleteSessionDialogProps {
  open: boolean;
  title: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export const DeleteSessionDialog: FC<DeleteSessionDialogProps> = (props) => {
  const { t } = useTranslation();

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("sessionList.deleteTitle")}</DialogTitle>
          <DialogDescription>
            {t("sessionList.deleteDescription", {
              title: props.title || t("common.untitled"),
            })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => props.onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button className="bg-red-600 text-white hover:bg-red-700" onClick={props.onConfirm}>
            {t("common.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
