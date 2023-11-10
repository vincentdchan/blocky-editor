import { Component, ReactNode, createRef } from "react";
import Sidebar from "@pkg/components/sidebar";
import {
  BlockyEditor,
  makeReactSpanner,
  makeReactToolbar,
  type SpannerRenderProps,
} from "blocky-react";
import { EditorController, IPlugin } from "blocky-core";
import makeStyledTextPlugin from "blocky-core/dist/plugins/styledTextPlugin";
import makeCodeTextPlugin from "blocky-core/dist/plugins/codeTextPlugin";
import makeBulletListPlugin from "blocky-core/dist/plugins/bulletListPlugin";
import makeHeadingsPlugin from "blocky-core/dist/plugins/headingsPlugin";
import { makeImageBlockPlugin } from "@pkg/plugins/imageBlock";
import { makeCommandPanelPlugin } from "@pkg/plugins/commandPanel";
import { makeAtPanelPlugin } from "@pkg/plugins/atPanel";
import SpannerMenu from "@pkg/spannerMenu";
import ToolbarMenu from "@pkg/toolbarMenu";
import { timer, Subject, takeUntil } from "rxjs";

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

function makeController(
  userId: string,
  scrollContainer: () => HTMLElement
): EditorController {
  return new EditorController(userId, {
    /**
     * Define the plugins to implement customize features.
     */
    plugins: makeEditorPlugins(),
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

class NoTitleEditor extends Component {
  controller: EditorController;
  containerRef = createRef<HTMLDivElement>();
  dispose$ = new Subject<void>();

  constructor(props: any) {
    super(props);
    this.controller = makeController("user", () => this.containerRef.current!);
  }

  componentDidMount(): void {
    timer(0)
      .pipe(takeUntil(this.dispose$))
      .subscribe(() => {
        this.controller.focus();
      });
  }

  componentWillUnmount(): void {
    this.dispose$.next();
  }

  render(): ReactNode {
    return (
      <div ref={this.containerRef} style={{ width: "100%", display: "flex" }}>
        <BlockyEditor controller={this.controller} />
      </div>
    );
  }
}

function NoTitle() {
  return (
    <div className="blocky-example-app-window">
      <Sidebar />
      <div className="blocky-example-container">
        <NoTitleEditor />
      </div>
    </div>
  );
}

export default NoTitle;
