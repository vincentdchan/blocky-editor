import React, { useCallback } from "react";
import { ReactBlockContext } from "../reactBlock";
import { type EditorController, CursorState } from "blocky-core";
import {
  useBlockActive,
  useCollaborativeOutlineColor,
  type BlockActiveDetectorProps,
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
  const detectProps: BlockActiveDetectorProps = {
    controller: editorController,
    blockId: blockId,
  };
  const active = useBlockActive(detectProps);
  const collaborativeOutlineColor = useCollaborativeOutlineColor(detectProps);

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
  return (
    <ReactBlockContext.Consumer>
      {(ctx) => (
        <DefaultBlockOutlineInternal
          editorController={ctx!.editorController}
          blockId={ctx!.blockId}
          {...props}
        />
      )}
    </ReactBlockContext.Consumer>
  );
}
