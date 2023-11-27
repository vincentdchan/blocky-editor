import { useState, useRef, useCallback, useEffect } from "react";
import ReactDOM from "react-dom";
import { type EditorController, BlockDataElement, TextType } from "blocky-core";
import Dropdown from "@pkg/components/dropdown";
import { Menu, MenuItem, Divider } from "@pkg/components/menu";
import { ImageBlockName } from "../";
import { Subject, takeUntil } from "rxjs";
import { SpannerIcon, buttonStyle } from "./style";

export interface SpannerProps {
  editorController: EditorController;
  focusedNode?: BlockDataElement;
}

interface Coord {
  x: number;
  y: number;
}

function SpannerMenu(props: SpannerProps) {
  const { editorController, focusedNode } = props;
  const [showDropdown, setShowDropdown] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [menuCoord, setMenuCoord] = useState<Coord>({ x: 0, y: 0 });
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dispose$ = new Subject<void>();

    const handleBlocksChanged = () => {
      const blockCount = editorController.state.blocks.size;

      const showDelete = blockCount > 1;
      setShowDelete(showDelete);
    };

    const { state } = editorController;
    state.newBlockCreated
      .pipe(takeUntil(dispose$))
      .subscribe(handleBlocksChanged);
    state.blockWillDelete
      .pipe(takeUntil(dispose$))
      .subscribe(handleBlocksChanged);

    handleBlocksChanged();

    bannerRef.current!.innerHTML = SpannerIcon;

    return () => {
      dispose$.next();
      dispose$.complete();
    };
  }, [editorController]);

  const handleClick = useCallback(() => {
    const rect = bannerRef.current!.getBoundingClientRect();
    ReactDOM.unstable_batchedUpdates(() => {
      setShowDropdown(true);
      setMenuCoord({ x: rect.x, y: rect.y });
    });
  }, []);

  const handleMaskClicked = useCallback(() => {
    setShowDropdown(false);
  }, []);

  const insertText = (textType: TextType) => () => {
    if (!focusedNode) {
      return;
    }
    const textElement = editorController.state.createTextElement(undefined, {
      textType,
    });
    editorController.insertBlockAfterId(textElement, focusedNode.id, {
      autoFocus: true,
    });
  };

  const insertImage = () => {
    if (!focusedNode) {
      return;
    }
    const newId = editorController.editor!.idGenerator.mkBlockId();
    const imgElement = new BlockDataElement(ImageBlockName, newId);
    editorController.insertBlockAfterId(imgElement, focusedNode.id, {
      autoFocus: true,
    });
  };

  const deleteBlock = () => {
    if (!focusedNode) {
      return;
    }
    editorController.deleteBlock(focusedNode.id);
  };

  const renderMenu = () => {
    const menuY = menuCoord.y + 36;
    return (
      <Menu
        style={{
          position: "fixed",
          left: `${menuCoord.x}px`,
          top: `${menuY}px`,
          ...{
            ["--blocky-font"]: editorController.editor?.fontFamily,
          },
        }}
      >
        <MenuItem onClick={insertText(TextType.Normal)}>Text</MenuItem>
        <MenuItem onClick={insertText(TextType.Heading1)}>Heading1</MenuItem>
        <MenuItem onClick={insertText(TextType.Heading2)}>Heading2</MenuItem>
        <MenuItem onClick={insertText(TextType.Heading3)}>Heading3</MenuItem>
        <MenuItem onClick={insertText(TextType.Checkbox)}>Checkbox</MenuItem>
        <MenuItem onClick={insertImage}>Image</MenuItem>
        {showDelete && (
          <>
            <Divider />
            <MenuItem
              style={{ color: "var(--danger-color)" }}
              onClick={deleteBlock}
            >
              Delete
            </MenuItem>
          </>
        )}
      </Menu>
    );
  };

  return (
    <Dropdown
      show={showDropdown}
      overlay={renderMenu()}
      onMaskClicked={handleMaskClicked}
    >
      <div ref={bannerRef} css={buttonStyle} onClick={handleClick}></div>
    </Dropdown>
  );
}

export default SpannerMenu;
