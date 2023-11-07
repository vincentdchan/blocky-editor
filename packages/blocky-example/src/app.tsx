import { Component, createRef, RefObject } from "preact";
import { useEffect, useState } from "preact/compat";
import { EditorController, darkTheme, type IPlugin } from "blocky-core";
import {
  BlockyEditor,
  makePreactBanner,
  makePreactToolbar,
  type BannerRenderProps,
} from "blocky-react";
import makeStyledTextPlugin from "blocky-core/dist/plugins/styledTextPlugin";
import makeCodeTextPlugin from "blocky-core/dist/plugins/codeTextPlugin";
import makeBulletListPlugin from "blocky-core/dist/plugins/bulletListPlugin";
import makeHeadingsPlugin from "blocky-core/dist/plugins/headingsPlugin";
import AppLogo from "@pkg/components/appLogo";
import SearchBox from "@pkg/components/searchBox";
import { makeImageBlockPlugin } from "./plugins/imageBlock";
import { makeCommandPanelPlugin } from "./plugins/commandPanel";
import { makeAtPanelPlugin } from "./plugins/atPanel";
import BannerMenu from "./bannerMenu";
import ToolbarMenu from "./toolbarMenu";
import TianShuiWeiImage from "./tianshuiwei.jpg";
import { ReadMeContent } from "./readme";
import { Link } from "preact-router/match";
import { ThemeSwitch, Theme } from "./themeSwitch";
import { isHotkey } from "is-hotkey";
import { Subject, takeUntil } from "rxjs";
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
  private dispose$ = new Subject<void>();

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

    this.editorControllerLeft.state.changesetApplied
    .pipe(takeUntil(this.dispose$))
    .subscribe((changeset) => {
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

    this.editorControllerRight.state.changesetApplied
    .pipe(takeUntil(this.dispose$))
    .subscribe((changeset) => {
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

    this.editorControllerLeft.cursorChanged
    .pipe(takeUntil(this.dispose$))
    .subscribe((evt) => {
      this.editorControllerRight.applyCursorChangedEvent(evt);
    });

    this.editorControllerRight.cursorChanged
    .pipe(takeUntil(this.dispose$))
    .subscribe((evt) => {
      this.editorControllerLeft.applyCursorChangedEvent(evt);
    });

    // paste before the editor initialized
    this.editorControllerLeft.pasteHTMLAtCursor(ReadMeContent);
  }

  componentWillUnmount(): void {
    this.dispose$.next();
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
          <BlockyEditorWithSearchBoxAndTitle
            containerRef={this.containerLeftRef}
            className="blocky-example-editor-container left"
            controller={this.editorControllerLeft}
          />
          <BlockyEditorWithSearchBoxAndTitle
            containerRef={this.containerRightRef}
            className="blocky-example-editor-container right"
            controller={this.editorControllerRight}
          />
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

function BlockyEditorWithTheme(props: BlockyEditorWithThemeProps) {
  const { darkMode, controller } = props;
  useEffect(() => {
    if (darkMode) {
      controller.themeData = darkTheme;
    } else {
      controller.themeData = undefined;
    }
  }, [darkMode]);
  return (
    <BlockyEditor
      controller={props.controller}
      autoFocus={props.autoFocus}
      ignoreInitEmpty={props.ignoreInitEmpty}
    />
  );
}

interface BlockyEditorWithSearchBoxAndTitleProps {
  containerRef: RefObject<HTMLDivElement>;
  className: string;
  controller: EditorController;
}

function BlockyEditorWithSearchBoxAndTitle(
  props: BlockyEditorWithSearchBoxAndTitleProps
) {
  const { controller } = props;
  const [showSearchBox, setShowSearchBox] = useState(false);
  useEffect(() => {
    const s = controller.editor?.keyDown.subscribe((e: KeyboardEvent) => {
      if (isHotkey("mod+f", e)) {
        e.preventDefault();
        setShowSearchBox(true);
      }
    });
    return () => s?.unsubscribe;
  }, [controller]);
  return (
    <div ref={props.containerRef} className={props.className}>
      {showSearchBox && (
        <SearchBox
          controller={controller}
          onClose={() => setShowSearchBox(false)}
        />
      )}
      <div className="blocky-example-content-container">
        <div className="blocky-example-image">
          <img src={TianShuiWeiImage} />
        </div>
        <Theme.Consumer>
          {(options) => (
            <BlockyEditorWithTheme
              controller={controller}
              darkMode={options.darkMode}
              ignoreInitEmpty
            />
          )}
        </Theme.Consumer>
      </div>
    </div>
  );
}

export default App;
