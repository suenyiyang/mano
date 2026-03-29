import { type FC, useState } from "react";
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
  const [reason, setReason] = useState("");

  return (
    <Dialog open={props.open} onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approval required</DialogTitle>
          <DialogDescription>{props.description}</DialogDescription>
        </DialogHeader>

        <Input
          placeholder="Reason for denial (optional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />

        <DialogFooter>
          <Button variant="ghost" onClick={() => props.onDeny(reason || undefined)}>
            Deny
          </Button>
          <Button onClick={props.onApprove}>Approve</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
