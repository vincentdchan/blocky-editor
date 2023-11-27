import { Component, type RefObject, createRef } from "react";
import { type EditorController, BlockDataElement, TextType } from "blocky-core";
import Dropdown from "@pkg/components/dropdown";
import { Menu, MenuItem, Divider } from "@pkg/components/menu";
import { ImageBlockName } from "blocky-react";
import { Subject, takeUntil } from "rxjs";
import "./spannerMenu.scss";

export interface SpannerProps {
  editorController: EditorController;
  focusedNode?: BlockDataElement;
}

interface SpannerState {
  showDropdown: boolean;
  menuX: number;
  menuY: number;
  showDelete: boolean;
}

const SpannerIcon = `
<svg role="graphics-symbol" viewBox="0 0 10 10" class="dragHandle" style="width: 14px; height: 14px; display: block; fill: inherit; flex-shrink: 0;"><path d="M3,2 C2.44771525,2 2,1.55228475 2,1 C2,0.44771525 2.44771525,0 3,0 C3.55228475,0 4,0.44771525 4,1 C4,1.55228475 3.55228475,2 3,2 Z M3,6 C2.44771525,6 2,5.55228475 2,5 C2,4.44771525 2.44771525,4 3,4 C3.55228475,4 4,4.44771525 4,5 C4,5.55228475 3.55228475,6 3,6 Z M3,10 C2.44771525,10 2,9.55228475 2,9 C2,8.44771525 2.44771525,8 3,8 C3.55228475,8 4,8.44771525 4,9 C4,9.55228475 3.55228475,10 3,10 Z M7,2 C6.44771525,2 6,1.55228475 6,1 C6,0.44771525 6.44771525,0 7,0 C7.55228475,0 8,0.44771525 8,1 C8,1.55228475 7.55228475,2 7,2 Z M7,6 C6.44771525,6 6,5.55228475 6,5 C6,4.44771525 6.44771525,4 7,4 C7.55228475,4 8,4.44771525 8,5 C8,5.55228475 7.55228475,6 7,6 Z M7,10 C6.44771525,10 6,9.55228475 6,9 C6,8.44771525 6.44771525,8 7,8 C7.55228475,8 8,8.44771525 8,9 C8,9.55228475 7.55228475,10 7,10 Z"></path></svg>
`;

class SpannerMenu extends Component<SpannerProps, SpannerState> {
  private bannerRef: RefObject<HTMLDivElement> = createRef();
  private dispose$ = new Subject<void>();

  constructor(props: SpannerProps) {
    super(props);
    this.state = {
      showDropdown: false,
      menuX: 0,
      menuY: 0,
      showDelete: false,
    };
  }

  override componentDidMount() {
    const { editorController } = this.props;
    const { state } = editorController;
    state.newBlockCreated
      .pipe(takeUntil(this.dispose$))
      .subscribe(this.handleBlocksChanged);
    state.blockWillDelete
      .pipe(takeUntil(this.dispose$))
      .subscribe(this.handleBlocksChanged);

    this.handleBlocksChanged();

    this.bannerRef.current!.innerHTML = SpannerIcon;
  }

  override componentWillUnmount() {
    this.dispose$.next();
  }

  private handleBlocksChanged = () => {
    const { editorController } = this.props;

    const blockCount = editorController.state.blocks.size;

    const showDelete = blockCount > 1;
    if (showDelete === this.state.showDelete) {
      return;
    }
    this.setState({ showDelete });
  };

  private handleClick = () => {
    const rect = this.bannerRef.current!.getBoundingClientRect();
    this.setState({
      showDropdown: true,
      menuX: rect.x,
      menuY: rect.y,
    });
  };

  private handleMaskClicked = () => {
    this.setState({
      showDropdown: false,
    });
  };

  private insertText = (textType: TextType) => () => {
    const { editorController, focusedNode } = this.props;
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

  private insertImage = () => {
    const { editorController, focusedNode } = this.props;
    if (!focusedNode) {
      return;
    }
    const newId = editorController.editor!.idGenerator.mkBlockId();
    const imgElement = new BlockDataElement(ImageBlockName, newId);
    editorController.insertBlockAfterId(imgElement, focusedNode.id, {
      autoFocus: true,
    });
  };

  private deleteBlock = () => {
    const { editorController, focusedNode } = this.props;
    if (!focusedNode) {
      return;
    }
    editorController.deleteBlock(focusedNode.id);
  };

  private renderMenu() {
    const { menuX, showDelete } = this.state;
    let { menuY } = this.state;
    menuY += 36;
    return (
      <Menu
        style={{ position: "fixed", left: `${menuX}px`, top: `${menuY}px` }}
      >
        <MenuItem onClick={this.insertText(TextType.Normal)}>Text</MenuItem>
        <MenuItem onClick={this.insertText(TextType.Heading1)}>
          Heading1
        </MenuItem>
        <MenuItem onClick={this.insertText(TextType.Heading2)}>
          Heading2
        </MenuItem>
        <MenuItem onClick={this.insertText(TextType.Heading3)}>
          Heading3
        </MenuItem>
        <MenuItem onClick={this.insertText(TextType.Checkbox)}>
          Checkbox
        </MenuItem>
        <MenuItem onClick={this.insertImage}>Image</MenuItem>
        {showDelete && (
          <>
            <Divider />
            <MenuItem
              style={{ color: "var(--danger-color)" }}
              onClick={this.deleteBlock}
            >
              Delete
            </MenuItem>
          </>
        )}
      </Menu>
    );
  }

  render() {
    const { showDropdown } = this.state;
    return (
      <Dropdown
        show={showDropdown}
        overlay={this.renderMenu()}
        onMaskClicked={this.handleMaskClicked}
      >
        <div
          ref={this.bannerRef}
          className="blocky-example-banner-button"
          onClick={this.handleClick}
        ></div>
      </Dropdown>
    );
  }
}

export default SpannerMenu;
