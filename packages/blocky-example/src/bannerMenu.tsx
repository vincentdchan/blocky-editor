import { Component, type RefObject, createRef } from "preact";
import { type EditorController, BlockElement, TextType } from "blocky-core";
import {
  type IDisposable,
  flattenDisposable,
} from "blocky-common/es/disposable";
import Dropdown from "@pkg/components/dropdown";
import { Menu, MenuItem, Divider } from "@pkg/components/menu";
import { ImageBlockName } from "@pkg/plugins/imageBlock";
import "./bannerMenu.scss";

export interface BannerProps {
  editorController: EditorController;
  focusedNode?: BlockElement;
}

interface BannerState {
  showDropdown: boolean;
  menuX: number;
  menuY: number;
  showDelete: boolean;
}

const BannerIcon = `
<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M16 17L48 17" stroke="#CAC4C4" stroke-width="6" stroke-linecap="round"/>
<path d="M16 32L48 32" stroke="#CAC4C4" stroke-width="6" stroke-linecap="round"/>
<path d="M16 47L48 47" stroke="#CAC4C4" stroke-width="6" stroke-linecap="round"/>
</svg>
`;

class BannerMenu extends Component<BannerProps, BannerState> {
  #bannerRef: RefObject<HTMLDivElement> = createRef();

  private disposables: IDisposable[] = [];

  constructor(props: BannerProps) {
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
    this.disposables.push(
      state.newBlockCreated.on(this.handleBlocksChanged),
      state.blockDeleted.on(this.handleBlocksChanged)
    );

    this.handleBlocksChanged();

    this.#bannerRef.current!.innerHTML = BannerIcon;
  }

  override componentWillUnmount() {
    flattenDisposable(this.disposables).dispose();
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
    const rect = this.#bannerRef.current!.getBoundingClientRect();
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
    const textElement = editorController.state.createTextElement({
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
    const imgElement = new BlockElement(ImageBlockName, newId);
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
          ref={this.#bannerRef}
          className="blocky-example-banner-button"
          onClick={this.handleClick}
        ></div>
      </Dropdown>
    );
  }
}

export default BannerMenu;
