import type { FC } from "react";
import { useParams } from "react-router";
import { ChatInput } from "../components/chat/chat-input.js";
import { AskUserDialog } from "../components/session/ask-user-dialog.js";
import { MessageList } from "../components/session/message-list.js";
import { Topbar } from "../components/session/topbar.js";
import { useSessionPageLogic } from "../hooks/use-session-page-logic.js";

export const SessionPage: FC = () => {
  const { sessionId } = useParams();

  if (!sessionId) return null;

  const pageLogic = useSessionPageLogic({ sessionId });

  return (
    <>
      <Topbar {...pageLogic.topbarProps} />
      <MessageList {...pageLogic.messageListProps} />
      {pageLogic.streamingError && (
        <div className="px-6 py-2 text-center text-base text-red-500">
          {pageLogic.streamingError}
        </div>
      )}
      <div className="flex justify-center px-6 py-3.5">
        <ChatInput {...pageLogic.chatInputProps} />
      </div>
      <AskUserDialog {...pageLogic.askUserDialogProps} />
    </>
  );
};
