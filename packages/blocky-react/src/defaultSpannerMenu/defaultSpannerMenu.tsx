import { useState, useRef, useCallback, useEffect } from "react";
import {
  type EditorController,
  BlockDataElement,
  TextType,
  SpannerDelegate,
} from "blocky-core";
import Dropdown from "@pkg/components/dropdown";
import { Menu, MenuItem, Divider } from "@pkg/components/menu";
import { ImageBlockPlugin } from "../";
import { Subject, takeUntil } from "rxjs";
import { SpannerIcon, buttonStyle } from "./style";
import { useTooltip } from "@pkg/components/tooltip";
import {
  LuType,
  LuHeading1,
  LuHeading2,
  LuHeading3,
  LuImage,
  LuCheckCircle2,
  LuTrash2,
} from "react-icons/lu";

export interface SpannerProps {
  editorController: EditorController;
  focusedNode?: BlockDataElement;
  uiDelegate: SpannerDelegate;
}

function DefaultSpannerMenu(props: SpannerProps) {
  const { editorController, focusedNode, uiDelegate } = props;
  const [showDropdown, setShowDropdown] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
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

    return () => {
      dispose$.next();
      dispose$.complete();
    };
  }, [editorController]);

  const handleClick = useCallback(() => {
    setShowDropdown(true);
    uiDelegate.alwaysShow = true;
  }, [uiDelegate]);

  const handleMaskClicked = useCallback(() => {
    setShowDropdown(false);
    uiDelegate.alwaysShow = false;
  }, [uiDelegate]);

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
    const imgElement = new BlockDataElement(ImageBlockPlugin.Name, newId);
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
    return (
      <Menu>
        <MenuItem icon={<LuType />} onClick={insertText(TextType.Normal)}>
          Text
        </MenuItem>
        <MenuItem icon={<LuHeading1 />} onClick={insertText(TextType.Heading1)}>
          Heading1
        </MenuItem>
        <MenuItem icon={<LuHeading2 />} onClick={insertText(TextType.Heading2)}>
          Heading2
        </MenuItem>
        <MenuItem icon={<LuHeading3 />} onClick={insertText(TextType.Heading3)}>
          Heading3
        </MenuItem>
        <MenuItem
          icon={<LuCheckCircle2 />}
          onClick={insertText(TextType.Checkbox)}
        >
          Checkbox
        </MenuItem>
        <MenuItem icon={<LuImage />} onClick={insertImage}>
          Image
        </MenuItem>
        {showDelete && (
          <>
            <Divider />
            <MenuItem
              icon={<LuTrash2 />}
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

  useTooltip({
    anchorElement: bannerRef,
    content: "Drag to move, click to open menu",
  });

  return (
    <Dropdown
      show={showDropdown}
      overlay={renderMenu}
      onMaskClicked={handleMaskClicked}
      anchorRef={bannerRef}
    >
      <div
        ref={bannerRef}
        css={buttonStyle}
        onClick={handleClick}
        dangerouslySetInnerHTML={{ __html: SpannerIcon }}
      ></div>
    </Dropdown>
  );
}

export default DefaultSpannerMenu;
