import type { FC, HTMLAttributes } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface TextBlockProps {
  content: string;
}

export const TextBlock: FC<TextBlockProps> = (props) => {
  return (
    <div className="text-base leading-[1.65] text-[var(--fg)]">
      <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {props.content}
      </Markdown>
    </div>
  );
};

const markdownComponents = {
  p: ({ children }: HTMLAttributes<HTMLParagraphElement>) => (
    <p className="mb-2 last:mb-0">{children}</p>
  ),
  h1: ({ children }: HTMLAttributes<HTMLHeadingElement>) => (
    <h1 className="mb-3 mt-4 text-xl font-semibold first:mt-0">{children}</h1>
  ),
  h2: ({ children }: HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className="mb-2 mt-3 text-lg font-semibold first:mt-0">{children}</h2>
  ),
  h3: ({ children }: HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="mb-2 mt-3 text-base font-semibold first:mt-0">{children}</h3>
  ),
  ul: ({ children }: HTMLAttributes<HTMLUListElement>) => (
    <ul className="mb-2 list-disc pl-5 last:mb-0">{children}</ul>
  ),
  ol: ({ children }: HTMLAttributes<HTMLOListElement>) => (
    <ol className="mb-2 list-decimal pl-5 last:mb-0">{children}</ol>
  ),
  li: ({ children }: HTMLAttributes<HTMLLIElement>) => <li className="mb-0.5">{children}</li>,
  code: ({ className, children, ...rest }: HTMLAttributes<HTMLElement>) => {
    const isBlock = className?.startsWith("language-");
    if (isBlock) {
      return (
        <code className={`${className} block`} {...rest}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded bg-[var(--bg-bubble)] px-1 py-px text-[12.5px]"
        style={{ fontFamily: "var(--font-mono)" }}
        {...rest}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }: HTMLAttributes<HTMLPreElement>) => (
    <pre
      className="mb-2 overflow-x-auto rounded-lg bg-[var(--bg-bubble)] p-3 text-[13px] leading-[1.5] last:mb-0"
      style={{ fontFamily: "var(--font-mono)" }}
    >
      {children}
    </pre>
  ),
  a: ({ children, ...rest }: HTMLAttributes<HTMLAnchorElement>) => (
    <a
      className="text-[var(--primary)] underline decoration-[var(--fg-faint)] underline-offset-2"
      target="_blank"
      rel="noopener noreferrer"
      {...rest}
    >
      {children}
    </a>
  ),
  blockquote: ({ children }: HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote className="mb-2 border-l-2 border-[var(--border)] pl-3 text-[var(--fg-muted)] last:mb-0">
      {children}
    </blockquote>
  ),
  table: ({ children }: HTMLAttributes<HTMLTableElement>) => (
    <div className="mb-2 overflow-x-auto last:mb-0">
      <table className="w-full border-collapse text-[13px]">{children}</table>
    </div>
  ),
  th: ({ children }: HTMLAttributes<HTMLTableCellElement>) => (
    <th className="border border-[var(--border)] bg-[var(--bg-bubble)] px-3 py-1.5 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }: HTMLAttributes<HTMLTableCellElement>) => (
    <td className="border border-[var(--border)] px-3 py-1.5">{children}</td>
  ),
  hr: () => <hr className="my-4 border-[var(--border)]" />,
};
