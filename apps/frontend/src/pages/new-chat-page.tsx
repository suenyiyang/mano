import type { FC } from "react";
import { ChatInput } from "../components/chat/chat-input.js";
import { Hero } from "../components/chat/hero.js";
import { QuickActions } from "../components/chat/quick-actions.js";
import { useNewChatPageLogic } from "../hooks/use-new-chat-page-logic.js";

export const NewChatPage: FC = () => {
  const { chatInputProps, handleQuickAction, isCreating } = useNewChatPageLogic();

  return (
    <div className="flex flex-1 flex-col items-center justify-center">
      <Hero />
      <ChatInput {...chatInputProps} disabled={isCreating} />
      <QuickActions onSelect={handleQuickAction} />
    </div>
  );
};
