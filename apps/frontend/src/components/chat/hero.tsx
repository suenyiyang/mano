import type { FC } from "react";

export const Hero: FC = () => {
  return (
    <div className="mb-8 flex flex-col items-center gap-1.5">
      <h1 className="text-[22px] font-[650] tracking-[-0.03em] text-[var(--fg)]">
        What can I help you with?
      </h1>
      <p className="text-sm text-[var(--fg-muted)]">
        Describe a task and Mano will handle it for you.
      </p>
    </div>
  );
};
