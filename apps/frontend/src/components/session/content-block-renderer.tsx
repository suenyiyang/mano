import type { FC } from "react";
import type { ContentBlock } from "../../types/message-turn.js";
import { StepBlock } from "./step-block.js";
import { TextBlock } from "./text-block.js";
import { ToolCallBlock } from "./tool-call-block.js";

interface ContentBlockRendererProps {
  blocks: ContentBlock[];
}

export const ContentBlockRenderer: FC<ContentBlockRendererProps> = (props) => {
  return (
    <>
      {props.blocks.map((block, i) => {
        const key = `block-${i}`;
        if (block.type === "text") {
          return <TextBlock key={key} content={block.content} />;
        }
        if (block.type === "tool_call") {
          return (
            <ToolCallBlock key={key} name={block.name} label={block.label} status={block.status} />
          );
        }
        if (block.type === "step") {
          return <StepBlock key={key} label={block.label} status={block.status} />;
        }
        return null;
      })}
    </>
  );
};
