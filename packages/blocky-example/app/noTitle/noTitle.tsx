import { useRef } from "react";
import {
  BlockyEditor,
  makeReactToolbar,
  ImageBlockPlugin,
  useBlockyController,
  DefaultToolbarMenu,
} from "blocky-react";
import { EditorController, IPlugin } from "blocky-core";
import ImagePlaceholder from "@pkg/components/imagePlaceholder";
import { makeCommandPanelPlugin } from "@pkg/app/plugins/commandPanel";
import { makeAtPanelPlugin } from "@pkg/app/plugins/atPanel";

function makeEditorPlugins(): IPlugin[] {
  return [
    new ImageBlockPlugin({
      placeholder: ({ setSrc }) => <ImagePlaceholder setSrc={setSrc} />,
    }),
    makeCommandPanelPlugin(),
    makeAtPanelPlugin(),
  ];
}

function makeController(userId: string): EditorController {
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
      return <DefaultToolbarMenu editorController={editorController} />;
    }),

    spellcheck: false,
  });
}

function NoTitleEditor() {
  const containerRef = useRef<HTMLDivElement>(null);

  const controller = useBlockyController(() => {
    return makeController("user");
  }, []);

  return (
    <div ref={containerRef} style={{ width: "100%", display: "flex" }}>
      <BlockyEditor
        controller={controller}
        scrollContainer={containerRef}
        autoFocus
      />
    </div>
  );
}

export default NoTitleEditor;
