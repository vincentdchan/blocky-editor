"use client";

import { Component, createRef, RefObject, useEffect, useState } from "react";
import { EditorController, darkTheme, type IPlugin } from "blocky-core";
import {
  BlockyEditor,
  makeReactSpanner,
  makeReactToolbar,
  makeImageBlockPlugin,
  type SpannerRenderProps,
} from "blocky-react";
import SearchBox from "@pkg/components/searchBox";
import ImagePlaceholder from "@pkg/components/imagePlaceholder";
import { makeCommandPanelPlugin } from "./plugins/commandPanel";
import { makeAtPanelPlugin } from "./plugins/atPanel";
import SpannerMenu from "./spannerMenu";
import ToolbarMenu from "./toolbarMenu";
import TianShuiWeiImage from "./tianshuiwei.jpg";
import Image from "next/image";
import { blockyExampleFont, Theme } from "./themeSwitch";
import { isHotkey } from "is-hotkey";
import { Subject, takeUntil } from "rxjs";
import "blocky-core/css/blocky-core.css";

function makeEditorPlugins(): IPlugin[] {
  return [
    makeImageBlockPlugin({
      placeholder: ({ setSrc }) => <ImagePlaceholder setSrc={setSrc} />,
    }),
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
    spannerFactory: makeReactSpanner(
      ({ editorController, focusedNode }: SpannerRenderProps) => (
        <SpannerMenu
          editorController={editorController}
          focusedNode={focusedNode}
        />
      )
    ),
    /**
     * Tell the editor how to render the banner.
     * We use a toolbar written in Preact here.
     */
    toolbarFactory: makeReactToolbar((editorController: EditorController) => {
      return <ToolbarMenu editorController={editorController} />;
    }),

    scrollContainer,

    spellcheck: false,
  });
}

export interface AppProps {
  initContent: string;
}

class App extends Component<AppProps> {
  private editorControllerLeft: EditorController;
  private editorControllerRight: EditorController;
  private containerLeftRef = createRef<HTMLDivElement>();
  private containerRightRef = createRef<HTMLDivElement>();
  private dispose$ = new Subject<void>();

  constructor(props: AppProps) {
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
    this.editorControllerLeft.pasteHTMLAtCursor(props.initContent);
  }

  componentWillUnmount(): void {
    this.dispose$.next();

    this.editorControllerLeft.dispose();
    this.editorControllerRight.dispose();
  }

  render() {
    return (
      <>
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
      </>
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
      controller.themeData = {
        ...darkTheme,
        font: blockyExampleFont,
      };
    } else {
      controller.themeData = {
        font: blockyExampleFont,
      };
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
    return () => s?.unsubscribe();
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
          <Image
            src={TianShuiWeiImage}
            alt=""
            sizes="100vw"
            // Make the image display full width
            style={{
              width: "100%",
              height: "auto",
            }}
          />
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
