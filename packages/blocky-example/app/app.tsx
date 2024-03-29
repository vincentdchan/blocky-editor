"use client";

import { Component, useEffect, useRef, useState } from "react";
import { EditorController, type IPlugin, SpannerPlugin } from "blocky-core";
import {
  ImageBlockPlugin,
  makeDefaultReactToolbar,
  makeDefaultReactSpanner,
} from "blocky-react";
import SearchBox from "@pkg/components/searchBox";
import ImagePlaceholder from "@pkg/components/imagePlaceholder";
import BlockyEditorWithTheme from "@pkg/components/editorWithTheme";
import { makeCommandPanelPlugin } from "./plugins/commandPanel";
import { makeAtPanelPlugin } from "./plugins/atPanel";
import TianShuiWeiImage from "./tianshuiwei.jpg";
import Image from "next/image";
import { isHotkey } from "is-hotkey";
import { Subject, takeUntil } from "rxjs";
import "blocky-core/css/blocky-core.css";

function makeEditorPlugins(): IPlugin[] {
  return [
    new ImageBlockPlugin({
      placeholder: ({ setSrc }) => <ImagePlaceholder setSrc={setSrc} />,
    }),
    /**
     * Tell the editor how to render the banner.
     * We use a banner written in React here.
     */
    new SpannerPlugin({
      factory: makeDefaultReactSpanner(),
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
     * We use a toolbar written in React here.
     */
    toolbarFactory: makeDefaultReactToolbar(),

    spellcheck: false,
  });
}

export interface AppProps {
  initContent: string;
}

class App extends Component<AppProps> {
  private editorControllerLeft: EditorController;
  private editorControllerRight: EditorController;
  private dispose$ = new Subject<void>();

  constructor(props: AppProps) {
    super(props);

    this.editorControllerLeft = makeController("User-1", "Blocky Editor");

    this.editorControllerRight = makeController("User-2", "Blocky Editor");

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
          className="blocky-example-editor-container left"
          controller={this.editorControllerLeft}
        />
        <BlockyEditorWithSearchBoxAndTitle
          className="blocky-example-editor-container right"
          controller={this.editorControllerRight}
        />
      </>
    );
  }
}

interface BlockyEditorWithSearchBoxAndTitleProps {
  className: string;
  controller: EditorController;
}

function BlockyEditorWithSearchBoxAndTitle(
  props: BlockyEditorWithSearchBoxAndTitleProps
) {
  const { controller } = props;
  const [showSearchBox, setShowSearchBox] = useState(false);
  const scrollContainer = useRef<HTMLDivElement>(null);
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
    <div className={props.className}>
      {showSearchBox && (
        <SearchBox
          controller={controller}
          onClose={() => setShowSearchBox(false)}
        />
      )}
      <div className="blocky-example-content-container" ref={scrollContainer}>
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
        <BlockyEditorWithTheme
          controller={controller}
          scrollContainer={scrollContainer}
          ignoreInitEmpty
        />
      </div>
    </div>
  );
}

export default App;
