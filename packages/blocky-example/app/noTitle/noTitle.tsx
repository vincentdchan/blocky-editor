import { Component, ReactNode, createRef } from "react";
import { BlockyEditor, makeReactToolbar } from "blocky-react";
import { EditorController, IPlugin } from "blocky-core";
import { makeImageBlockPlugin } from "@pkg/app/plugins/imageBlock";
import { makeCommandPanelPlugin } from "@pkg/app/plugins/commandPanel";
import { makeAtPanelPlugin } from "@pkg/app/plugins/atPanel";
import ToolbarMenu from "@pkg/app/toolbarMenu";
import { timer, Subject, takeUntil } from "rxjs";

function makeEditorPlugins(): IPlugin[] {
  return [
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

export default NoTitleEditor;
