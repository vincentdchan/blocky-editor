import React, { useState, memo, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import { type EditorController, CursorState } from "blocky-core";
import Mask from "@pkg/components/mask";
import { AnchorToolbar } from "./anchorToolbar";
import { toolbarMenuButton, toolbarContainerStyle } from "./style";
import { useTooltip } from "..";

interface ToolbarMenuItemProps extends React.HTMLAttributes<HTMLButtonElement> {
  tooltip: string;
}

const ToolbarMenuItem = memo((props: ToolbarMenuItemProps) => {
  const { tooltip, ...restProps } = props;
  const buttonRef = useRef<HTMLButtonElement>(null);

  useTooltip({
    anchorElement: buttonRef,
    content: tooltip,
    direction: "top",
  });

  return <button css={toolbarMenuButton} ref={buttonRef} {...restProps} />;
});

export interface DefaultToolbarMenuProps {
  editorController: EditorController;
}

interface Coord {
  x: number;
  y: number;
}

function DefaultToolbarMenu(props: DefaultToolbarMenuProps) {
  const { editorController } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const [showAnchorToolbar, setShowAnchorToolbar] = useState(false);
  const [anchorToolbarCoord, setAnchorToolbarCoord] = useState<Coord | null>(
    null
  );
  const cursorState = useRef<CursorState | null>(null);

  const handleBold = useCallback(() => {
    editorController.formatTextOnSelectedText({
      bold: true,
    });
  }, [editorController]);

  const handleItalic = useCallback(() => {
    editorController.formatTextOnSelectedText({
      italic: true,
    });
  }, [editorController]);

  const handleUnderline = useCallback(() => {
    editorController.formatTextOnSelectedText({
      underline: true,
    });
  }, [editorController]);

  const handleLinkClicked = () => {
    // save the cursor state
    cursorState.current = editorController.editor!.state.cursorState;

    const container = containerRef.current!;
    const rect = container.getBoundingClientRect();
    ReactDOM.unstable_batchedUpdates(() => {
      setShowAnchorToolbar(true);
      setAnchorToolbarCoord({
        x: rect.x,
        y: rect.y - 36,
      });
    });
  };

  const handleMaskClicked = useCallback(() => {
    setShowAnchorToolbar(false);
  }, []);

  const handleSubmitLink = (link: string) => {
    setShowAnchorToolbar(false);
    if (!cursorState.current) {
      return;
    }
    editorController.formatTextOnCursor(cursorState.current, {
      href: link,
    });
  };

  return (
    <>
      <div ref={containerRef} css={toolbarContainerStyle}>
        <ToolbarMenuItem
          tooltip="Bold"
          className="bold rect"
          onClick={handleBold}
        >
          B
        </ToolbarMenuItem>
        <ToolbarMenuItem
          tooltip="Italic"
          className="italic rect"
          onClick={handleItalic}
        >
          I
        </ToolbarMenuItem>
        <ToolbarMenuItem
          tooltip="Underline"
          className="underline rect"
          onClick={handleUnderline}
        >
          U
        </ToolbarMenuItem>
        <ToolbarMenuItem tooltip="Link" onClick={handleLinkClicked}>
          Link
        </ToolbarMenuItem>
      </div>
      {showAnchorToolbar && (
        <Mask onClick={handleMaskClicked}>
          <AnchorToolbar
            onSubmitLink={handleSubmitLink}
            style={{
              top: (anchorToolbarCoord?.y ?? 0) + "px",
              left: (anchorToolbarCoord?.x ?? 0) + "px",
            }}
          />
        </Mask>
      )}
    </>
  );
}

export default DefaultToolbarMenu;
