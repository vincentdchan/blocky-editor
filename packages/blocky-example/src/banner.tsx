import { Component, type RefObject, createRef } from "preact";
import { type EditorController } from "blocky-core";
import Dropdown from "@pkg/components/dropdown";
import { Menu, MenuItem } from "@pkg/components/menu";
import "./banner.scss";

export interface BannerProps {
  editorController: EditorController;
}

interface BannerState {
  showDropdown: boolean;
  menuX: number;
  menuY: number;
}

class Banner extends Component<BannerProps, BannerState> {
  #bannerRef: RefObject<HTMLDivElement> = createRef();

  constructor(props: BannerProps) {
    super(props);
    this.state = {
      showDropdown: false,
      menuX: 0,
      menuY: 0,
    };
  }

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

  private renderMenu() {
    const { menuX } = this.state;
    let { menuY } = this.state;
    menuY += 36;
    return (
      <Menu
        style={{ position: "fixed", left: `${menuX}px`, top: `${menuY}px` }}
      >
        <MenuItem onClick={this.insertHeading(1)}>Heading1</MenuItem>
        <MenuItem onClick={this.insertHeading(2)}>Heading2</MenuItem>
        <MenuItem onClick={this.insertHeading(3)}>Heading3</MenuItem>
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

export default Banner;
