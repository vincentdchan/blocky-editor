import { Component } from "preact";
import { EditorController, type IPlugin } from "blocky-core";
import {
  BlockyEditor,
  makePreactBanner,
  makePreactToolbar,
  type BannerRenderProps,
} from "blocky-preact";
import makeBoldedTextPlugin from "blocky-core/dist/plugins/boldedTextPlugin";
import makeCodeTextPlugin from "blocky-core/dist/plugins/codeTextPlugin";
import makeBulletListPlugin from "blocky-core/dist/plugins/bulletListPlugin";
import makeHeadingsPlugin from "blocky-core/dist/plugins/headingsPlugin";
import { makeImageBlockPlugin } from "./plugins/imageBlock";
import { makeCommandPanelPlugin } from "./plugins/commandPanel";
import BannerMenu from "./bannerMenu";
import ToolbarMenu from "./toolbarMenu";
import TianShuiWeiImage from "./tianshuiwei.jpg";
import { ReadMeContent } from "./readme";
import "blocky-core/css/bolded-text-plugin.css";
import "blocky-core/css/blocky-core.css";
import "./app.scss";

function makeEditorPlugins(): IPlugin[] {
  return [
    makeBoldedTextPlugin(),
    makeCodeTextPlugin(),
    makeBulletListPlugin(),
    makeHeadingsPlugin(),
    makeImageBlockPlugin(),
    makeCommandPanelPlugin(),
  ];
}

const User1Color = "rgb(235 100 52)";
const User2Color = "rgb(246 187 80)";

/**
 * The controller is used to control the editor.
 */
function makeController(userId: string, title: string): EditorController {
  return new EditorController(userId, {
    title,
    collaborativeCursorFactory: (id: string) => ({
      get name() {
        return id;
      },
      get color() {
        if (id === "User-1") {
          return User1Color;
        }
        return User2Color;
      },
    }),
    /**
     * Define the plugins to implement customize features.
     */
    plugins: makeEditorPlugins(),
    /**
     * Tell the editor how to render the banner.
     * We use a banner written in Preact here.
     */
    bannerFactory: makePreactBanner(
      ({ editorController, focusedNode }: BannerRenderProps) => (
        <BannerMenu
          editorController={editorController}
          focusedNode={focusedNode}
        />
      )
    ),
    /**
     * Tell the editor how to render the banner.
     * We use a toolbar written in Preact here.
     */
    toolbarFactory: makePreactToolbar((editorController: EditorController) => {
      return <ToolbarMenu editorController={editorController} />;
    }),
  });
}

class App extends Component<unknown> {
  private editorControllerLeft: EditorController;
  private editorControllerRight: EditorController;

  constructor(props: unknown) {
    super(props);

    this.editorControllerLeft = makeController("User-1", "Blocky Editor");

    this.editorControllerRight = makeController("User-2", "Blocky Editor");

    this.editorControllerLeft.state.changesetApplied.on((changeset) => {
      // simulate the net work
      setTimeout(() => {
        this.editorControllerRight.state.apply({
          ...changeset,
          afterCursor: undefined,
          options: {
            ...changeset.options,
            updateView: true,
          },
        });
      });
    });

    this.editorControllerRight.state.changesetApplied.on((changeset) => {
      setTimeout(() => {
        this.editorControllerLeft.state.apply({
          ...changeset,
          afterCursor: undefined,
          options: {
            ...changeset.options,
            updateView: true,
          },
        });
      });
    });

    this.editorControllerLeft.cursorChanged.on((evt) => {
      this.editorControllerRight.applyCursorChangedEvent(evt);
    });

    this.editorControllerRight.cursorChanged.on((evt) => {
      this.editorControllerLeft.applyCursorChangedEvent(evt);
    });

    // paste before the editor initialized
    this.editorControllerLeft.pasteHTMLAtCursor(ReadMeContent);
  }

  render() {
    return (
      <div className="blocky-example-app-window">
        <div className="blocky-example-container">
          <div className="blocky-example-image">
            <img src={TianShuiWeiImage} />
          </div>
          <div className="blocky-example-badge-container">
            <a
              href="https://github.com/vincentdchan/blocky-editor"
              target="_blank"
            >
              <img
                alt="GitHub Repo stars"
                src="https://img.shields.io/github/stars/vincentdchan/blocky-editor?style=social"
              />
            </a>
            <a href="https://twitter.com/cdz_solo" target="_blank">
              <img
                alt="Twitter Follow"
                src="https://img.shields.io/twitter/follow/cdz_solo?style=social"
              ></img>
            </a>
          </div>
          <div className="blocky-example-editors">
            <div className="blocky-example-editor-container left">
              <div className="blocky-example-user">
                <span style={{ backgroundColor: User1Color }}>User 1</span>
              </div>
              <BlockyEditor controller={this.editorControllerLeft} />
            </div>
            <div className="blocky-example-editor-container right">
              <div className="blocky-example-user">
                <span style={{ backgroundColor: User2Color }}>User 2</span>
              </div>
              <BlockyEditor
                controller={this.editorControllerRight}
                ignoreInitEmpty
              />
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default App;
