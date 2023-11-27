import { useRef } from "react";
import {
  BlockyEditor,
  makeReactToolbar,
  makeImageBlockPlugin,
  useBlockyController,
  DefaultToolbarMenu,
  DefaultSpannerMenu,
  makeReactSpanner,
  type SpannerRenderProps,
} from "blocky-react";
import { EditorController, IPlugin } from "blocky-core";
import ImagePlaceholder from "@pkg/components/imagePlaceholder";
import { makeCommandPanelPlugin } from "@pkg/app/plugins/commandPanel";
import { makeAtPanelPlugin } from "@pkg/app/plugins/atPanel";
import LoroPlugin from "./loroPlugin";
import styles from "./loroExample.module.scss";

function makeEditorPlugins(): IPlugin[] {
  return [
    makeImageBlockPlugin({
      placeholder: ({ setSrc }) => <ImagePlaceholder setSrc={setSrc} />,
    }),
    makeCommandPanelPlugin(),
    makeAtPanelPlugin(),
    new LoroPlugin(),
  ];
}

function makeController(userId: string): EditorController {
  return new EditorController(userId, {
    title: "Loro",
    /**
     * Define the plugins to implement customize features.
     */
    plugins: makeEditorPlugins(),
    spannerFactory: makeReactSpanner(
      ({ editorController, focusedNode }: SpannerRenderProps) => (
        <DefaultSpannerMenu
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
      return <DefaultToolbarMenu editorController={editorController} />;
    }),

    spellcheck: false,
  });
}

function LoroExample() {
  const containerRef = useRef<HTMLDivElement>(null);

  const controller = useBlockyController(() => {
    const controller = makeController("user");

    controller.pasteHTMLAtCursor(
      `Loro is a high-performance CRDTs library. It's written in Rust and introduced to the browser via WASM, offering incredible performance.
Blocky can leverage Loro's data syncing capabilities. By using a simple plugin, you can sync the data of the Blocky editor with Loro.
You can edit this page, and the data will sync to the browser's storage with Loro’s encoding.
Once you reload the page, the data from the browser will be rendered again.`
    );

    return controller;
  }, []);

  return (
    <div className={styles.editorContainer} ref={containerRef}>
      <BlockyEditor
        controller={controller}
        scrollContainer={containerRef}
        autoFocus
      />
    </div>
  );
}

export default LoroExample;
