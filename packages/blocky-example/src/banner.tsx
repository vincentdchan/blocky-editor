import { Component } from "preact";
import { type Editor } from "blocky-core";
import Dropdown from "@pkg/components/dropdown";
import "./banner.scss";

export interface BannerProps {
  editor: Editor;
}

export interface BannerProps {
  editor: Editor;
}

interface BannerState {
  showDropdown: boolean;
}

class Banner extends Component<BannerProps, BannerState> {

  constructor(props: BannerProps) {
    super(props);
    this.state = {
      showDropdown: false
    };
  }

  private handleClick = () => {
    this.setState({
      showDropdown: true,
    });
  };

  render() {
    const { showDropdown } = this.state;
    return (
      <Dropdown show={showDropdown}>
        <div
          className="blocky-example-banner-button"
          onClick={this.handleClick}
        ></div>
      </Dropdown>
    );
  }
}

export default Banner;
