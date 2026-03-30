import type { FC } from "react";
import type { Message } from "../../types/api.js";

interface UserMessageProps {
  message: Message;
}

export const UserMessage: FC<UserMessageProps> = (props) => {
  const content = typeof props.message.content === "string" ? props.message.content : "";

  return (
    <div className="mb-6 flex justify-end">
      <div className="max-w-[85%] rounded-[18px_18px_4px_18px] bg-[var(--bg-bubble)] px-4 py-2.5 text-base leading-[1.55] text-[var(--fg)]">
        {content}
      </div>
    </div>
  );
};
