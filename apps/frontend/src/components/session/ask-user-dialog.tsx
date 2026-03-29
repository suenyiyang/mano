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

interface AskUserDialogProps {
  open: boolean;
  question: string;
  options?: string[];
  onAnswer: (answer: string) => void;
  onClose: () => void;
}

export const AskUserDialog: FC<AskUserDialogProps> = (props) => {
  const [answer, setAnswer] = useState("");

  const handleSubmit = () => {
    if (!answer.trim()) return;
    props.onAnswer(answer.trim());
    setAnswer("");
  };

  const handleOptionSelect = (option: string) => {
    props.onAnswer(option);
  };

  return (
    <Dialog open={props.open} onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mano needs your input</DialogTitle>
          <DialogDescription>{props.question}</DialogDescription>
        </DialogHeader>

        {props.options && props.options.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {props.options.map((option) => (
              <Button
                key={option}
                variant="outline"
                size="sm"
                onClick={() => handleOptionSelect(option)}
              >
                {option}
              </Button>
            ))}
          </div>
        ) : (
          <Input
            placeholder="Type your answer..."
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
          />
        )}

        {!props.options && (
          <DialogFooter>
            <Button variant="ghost" onClick={props.onClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!answer.trim()}>
              Submit
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};
