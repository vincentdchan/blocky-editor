import { useState, useRef, useCallback, useEffect } from "react";
import {
  type EditorController,
  BlockDataElement,
  TextType,
  SpannerDelegate,
  bky,
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
import { isUndefined } from "lodash-es";

export interface MenuCommand {
  title: string;
  icon: React.ReactNode;
  insertText?: TextType;
  insertBlock?: () => BlockDataElement;
}

export interface SpannerProps {
  editorController: EditorController;
  focusedNode?: BlockDataElement;
  uiDelegate: SpannerDelegate;
  commands?: MenuCommand[];
}

const defaultCommands: MenuCommand[] = [
  {
    title: "Text",
    icon: <LuType />,
    insertText: TextType.Normal,
  },
  {
    title: "Heading1",
    icon: <LuHeading1 />,
    insertText: TextType.Heading1,
  },
  {
    title: "Heading2",
    icon: <LuHeading2 />,
    insertText: TextType.Heading2,
  },
  {
    title: "Heading3",
    icon: <LuHeading3 />,
    insertText: TextType.Heading3,
  },
  {
    title: "Checkbox",
    icon: <LuCheckCircle2 />,
    insertText: TextType.Checkbox,
  },
  {
    title: "Image",
    icon: <LuImage />,
    insertBlock: () => bky.element(ImageBlockPlugin.Name),
  },
];

function DefaultSpannerMenu(props: SpannerProps) {
  const {
    editorController,
    focusedNode,
    uiDelegate,
    commands = defaultCommands,
  } = props;
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

  const insertText = (textType: TextType) => {
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

  const deleteBlock = () => {
    if (!focusedNode) {
      return;
    }
    editorController.deleteBlock(focusedNode.id);
  };

  const renderMenu = () => {
    return (
      <Menu>
        {commands.map((command, index) => {
          return (
            <MenuItem
              key={`${index}`}
              icon={command.icon}
              onClick={() => {
                if (!isUndefined(command.insertText)) {
                  insertText(command.insertText);
                } else if (command.insertBlock) {
                  if (!focusedNode) {
                    return;
                  }
                  const imgElement = command.insertBlock();
                  editorController.insertBlockAfterId(
                    imgElement,
                    focusedNode.id,
                    {
                      autoFocus: true,
                    }
                  );
                }
              }}
            >
              {command.title}
            </MenuItem>
          );
        })}
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
