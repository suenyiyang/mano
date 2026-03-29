import type { FC } from "react";

interface TextBlockProps {
  content: string;
}

export const TextBlock: FC<TextBlockProps> = (props) => {
  const paragraphs = props.content.split("\n\n").filter(Boolean);

  return (
    <div className="text-sm leading-[1.65] text-[var(--fg)]">
      {paragraphs.map((p, i) => (
        <p key={`p-${i}`} className="mb-2 last:mb-0">
          {renderInlineCode(p)}
        </p>
      ))}
    </div>
  );
};

const renderInlineCode = (text: string) => {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={`code-${i}`}
          className="rounded bg-[var(--bg-bubble)] px-1 py-px text-[12.5px]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
};
