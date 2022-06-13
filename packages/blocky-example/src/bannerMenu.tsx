import { Component, type RefObject, createRef } from "preact";
import { type EditorController } from "blocky-core";
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
}

interface BannerState {
  showDropdown: boolean;
  menuX: number;
  menuY: number;
  showDelete: boolean;
}

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
      state.newBlockInserted.on(this.handleBlocksChanged),
      state.blockDeleted.on(this.handleBlocksChanged)
    );

    this.handleBlocksChanged();
  }

  override componentWillUnmount() {
    flattenDisposable(this.disposables).dispose();
  }

  private handleBlocksChanged = () => {
    const { editorController } = this.props;

    // TODO(optimize)
    let blockCount = 0;
    for (const node of editorController.state.idMap.values()) {
      if (node.data.t === "block") {
        blockCount++;
      }
    }

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

  private insertHeading = (level: number) => () => {
    const { editorController } = this.props;
    const focusedNode = editorController.bannerFocusedNode;
    if (!focusedNode) {
      return;
    }
    editorController.insertBlockAfterId(focusedNode.data.id, {
      autoFocus: true,
      data: { level },
    });
  };

  private insertImage = () => {
    const { editorController } = this.props;
    const focusedNode = editorController.bannerFocusedNode;
    if (!focusedNode) {
      return;
    }
    editorController.insertBlockAfterId(focusedNode.data.id, {
      autoFocus: true,
      blockName: ImageBlockName,
    });
  };

  private deleteBlock = () => {
    const { editorController } = this.props;
    const focusedNode = editorController.bannerFocusedNode;
    if (!focusedNode) {
      return;
    }
    editorController.deleteBlock(focusedNode.data.id);
  };

  private renderMenu() {
    const { menuX, showDelete } = this.state;
    let { menuY } = this.state;
    menuY += 36;
    return (
      <Menu
        style={{ position: "fixed", left: `${menuX}px`, top: `${menuY}px` }}
      >
        <MenuItem onClick={this.insertHeading(1)}>Heading1</MenuItem>
        <MenuItem onClick={this.insertHeading(2)}>Heading2</MenuItem>
        <MenuItem onClick={this.insertHeading(3)}>Heading3</MenuItem>
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
