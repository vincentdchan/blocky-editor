import { Component, createRef } from "preact";
import { EditorController, darkTheme, type IPlugin } from "blocky-core";
import {
  BlockyEditor,
  makePreactBanner,
  makePreactToolbar,
  type BannerRenderProps,
} from "blocky-preact";
import makeStyledTextPlugin from "blocky-core/dist/plugins/styledTextPlugin";
import makeCodeTextPlugin from "blocky-core/dist/plugins/codeTextPlugin";
import makeBulletListPlugin from "blocky-core/dist/plugins/bulletListPlugin";
import makeHeadingsPlugin from "blocky-core/dist/plugins/headingsPlugin";
import AppLogo from "@pkg/components/appLogo";
import { makeImageBlockPlugin } from "./plugins/imageBlock";
import { makeCommandPanelPlugin } from "./plugins/commandPanel";
import { makeAtPanelPlugin } from "./plugins/atPanel";
import BannerMenu from "./bannerMenu";
import ToolbarMenu from "./toolbarMenu";
import TianShuiWeiImage from "./tianshuiwei.jpg";
import { ReadMeContent } from "./readme";
import { Link } from "preact-router/match";
import { ThemeSwitch, Theme } from "./themeSwitch";
import "blocky-core/css/styled-text-plugin.css";
import "blocky-core/css/blocky-core.css";
import "./app.scss";

function makeEditorPlugins(): IPlugin[] {
  return [
    makeStyledTextPlugin(),
    makeCodeTextPlugin(),
    makeBulletListPlugin(),
    makeHeadingsPlugin(),
    makeImageBlockPlugin(),
    makeCommandPanelPlugin(),
    makeAtPanelPlugin(),
  ];
}

const User1Color = "rgb(235 100 52)";
const User2Color = "rgb(246 187 80)";

/**
 * The controller is used to control the editor.
 */
function makeController(
  userId: string,
  title: string,
  scrollContainer: () => HTMLElement
): EditorController {
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

    scrollContainer,

    spellcheck: false,
  });
}

class App extends Component<unknown> {
  private editorControllerLeft: EditorController;
  private editorControllerRight: EditorController;
  private containerLeftRef = createRef<HTMLDivElement>();
  private containerRightRef = createRef<HTMLDivElement>();

  constructor(props: unknown) {
    super(props);

    this.editorControllerLeft = makeController(
      "User-1",
      "Blocky Editor",
      () => this.containerLeftRef.current!
    );

    this.editorControllerRight = makeController(
      "User-2",
      "Blocky Editor",
      () => this.containerRightRef.current!
    );

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
        <div className="blocky-example-sidebar-container">
          <header>
            <Link href="/">
              <AppLogo />
            </Link>
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
            </div>
            <div
              className="blocky-example-badge-container"
              style={{ marginTop: 8 }}
            >
              <a href="https://twitter.com/cdz_solo" target="_blank">
                <img
                  alt="Twitter Follow"
                  src="https://img.shields.io/twitter/follow/cdz_solo?style=social"
                ></img>
              </a>
            </div>
            <ThemeSwitch />
          </header>
          <div>
            <Link className="blocky-example-link" href="/doc/get-started">
              Get started
            </Link>
            <Link className="blocky-example-link" href="/doc/api">
              Api
            </Link>
          </div>
        </div>
        <div className="blocky-example-container">
          <div
            ref={this.containerLeftRef}
            className="blocky-example-editor-container left"
          >
            <div className="blocky-example-image">
              <img src={TianShuiWeiImage} />
            </div>
            <Theme.Consumer>
              {(options) => (
                <BlockyEditorWithTheme
                  controller={this.editorControllerLeft}
                  darkMode={options.darkMode}
                  autoFocus
                />
              )}
            </Theme.Consumer>
          </div>
          <div
            ref={this.containerRightRef}
            className="blocky-example-editor-container right"
          >
            <div className="blocky-example-image">
              <img src={TianShuiWeiImage} />
            </div>
            <Theme.Consumer>
              {(options) => (
                <BlockyEditorWithTheme
                  controller={this.editorControllerRight}
                  darkMode={options.darkMode}
                  ignoreInitEmpty
                />
              )}
            </Theme.Consumer>
          </div>
        </div>
      </div>
    );
  }
}

interface BlockyEditorWithThemeProps {
  controller: EditorController;
  ignoreInitEmpty?: boolean;
  autoFocus?: boolean;
  darkMode?: boolean;
}

class BlockyEditorWithTheme extends Component<BlockyEditorWithThemeProps> {
  componentDidMount() {
    if (this.props.darkMode) {
      this.props.controller.themeData = darkTheme;
    }
  }

  componentWillReceiveProps(nextProps: BlockyEditorWithThemeProps) {
    if (this.props.darkMode !== nextProps.darkMode) {
      if (nextProps.darkMode) {
        nextProps.controller.themeData = darkTheme;
      } else {
        nextProps.controller.themeData = undefined;
      }
    }
  }

  render(props: BlockyEditorWithThemeProps) {
    return (
      <BlockyEditor
        controller={props.controller}
        autoFocus={props.autoFocus}
        ignoreInitEmpty={props.ignoreInitEmpty}
      />
    );
  }
}

export default App;
