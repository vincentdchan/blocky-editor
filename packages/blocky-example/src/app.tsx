import { Component, JSX } from "preact";
import { EditorController } from "blocky-core";
import { BlockyEditor, makePreactBanner, makePreactToolbar } from "blocky-preact";
import makeBoldedTextPlugin from "blocky-core/dist/plugins/boldedTextPlugin";
import makeBulletListPlugin from "blocky-core/dist/plugins/bulletListPlugin";
import { makeImageBlockPlugin } from "./plugins/imageBlock";
import BannerMenu from "./bannerMenu";
import ToolbarMenu from "./toolbarMenu";
import TianShuiWeiImage from "./tianshuiwei.jpg";
import { ReadMeContent } from "./readme";
import "blocky-core/css/bolded-text-plugin.css";
import "blocky-core/css/blocky-core.css";
import "./app.scss";

interface AppState {
  headingContent: string;
}

/**
 * The controller is used to control the editor.
 */
function makeController(): EditorController {
  return new EditorController({
    /**
     * Define the plugins to implement customize features.
     */
    plugins: [
      makeBoldedTextPlugin(),
      makeBulletListPlugin(),
      makeImageBlockPlugin(),
    ],
    /**
     * Tell the editor how to render the banner.
     * We use a banner written in Preact here.
     */
    bannerFactory: makePreactBanner((editorController: EditorController) => (
      <BannerMenu editorController={editorController} />
    )),
    /**
     * Tell the editor how to render the banner.
     * We use a toolbar written in Preact here.
     */
    toolbarFactory: makePreactToolbar((editorController: EditorController) => {
      return <ToolbarMenu editorController={editorController} />;
    }),
  });
}

class App extends Component<{}, AppState> {
  private editorController: EditorController;

  constructor(props: {}) {
    super(props);
    this.editorController = makeController();
    this.editorController.enqueueNextTick(this.firstTick);
    this.state = {
      headingContent: "Blocky Editor",
    };
  }

  private firstTick = () => {
    const { editor } = this.editorController;
    if (!editor) {
      return;
    }
    editor.pasteHTMLAtCursor(ReadMeContent);
  }

  private handleHeadingChanged = (e: JSX.TargetedEvent<HTMLInputElement>) => {
    this.setState({
      headingContent: (e.target! as HTMLInputElement).value,
    });
  };

  render() {
    return (
      <div className="blocky-example-app-window">
        <div className="blocky-example-container">
          <div className="blocky-example-image">
            <img src={TianShuiWeiImage} />
          </div>
          <div className="blocky-example-badge-container">
            <a href="https://github.com/vincentdchan/blocky-editor" target="_blank">
              <img alt="GitHub Repo stars" src="https://img.shields.io/github/stars/vincentdchan/blocky-editor?style=social" />
            </a>
            <a href="https://twitter.com/cdz_solo" target="_blank">
              <img alt="Twitter Follow" src="https://img.shields.io/twitter/follow/cdz_solo?style=social"></img>
            </a>
          </div>
          <div className="blocky-example-title-container">
            <input
              value={this.state.headingContent}
              onChange={this.handleHeadingChanged}
            />
          </div>
          {/* Pass the controller to the editor */}
          <BlockyEditor controller={this.editorController} />
        </div>
      </div>
    );
  }
}

export default App;
