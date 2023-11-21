import React, { useCallback, useContext } from "react";
import { ReactBlockContext } from "../reactBlock";
import { type EditorController, CursorState } from "blocky-core";
import {
  useBlockActive,
  useCollaborativeOutlineColor,
} from "../blockActiveDetector";
import { isString } from "lodash-es";

interface DefaultBlockOutlineInternalProps {
  editorController: EditorController;
  blockId: string;
  outlineColor?: string;
  focusOutlineColor?: string;
  children?: any;
}

// default color for the outline
const userFocusedColor = `rgb(52, 184, 220)`;

function DefaultBlockOutlineInternal(props: DefaultBlockOutlineInternalProps) {
  const { focusOutlineColor, outlineColor, editorController, blockId } = props;
  const active = useBlockActive();
  const collaborativeOutlineColor = useCollaborativeOutlineColor();

  const handleContainerClicked = useCallback(() => {
    editorController.setCursorState(CursorState.collapse(blockId, 0));
  }, [blockId]);

  let style: React.CSSProperties | undefined;
  if (active) {
    style = {
      boxShadow: `0 0 0 1pt ${focusOutlineColor ?? userFocusedColor}`,
    };
  } else if (typeof collaborativeOutlineColor === "string") {
    style = {
      boxShadow: `0 0 0 1pt ${collaborativeOutlineColor}`,
    };
  } else if (isString(outlineColor)) {
    style = {
      boxShadow: `0 0 0 1pt ${outlineColor}`,
    };
  }
  return (
    <div
      className="blocky-default-block-outline"
      style={style}
      onClick={handleContainerClicked}
    >
      {props.children}
    </div>
  );
}

export interface DefaultBlockOutlineProps {
  outlineColor?: string;
  focusOutlineColor?: string;
  children?: any;
}

export function DefaultBlockOutline(props: DefaultBlockOutlineProps) {
  const ctx = useContext(ReactBlockContext)!;
  return (
    <DefaultBlockOutlineInternal
      editorController={ctx.editorController}
      blockId={ctx.blockId}
      {...props}
    />
  );
}
