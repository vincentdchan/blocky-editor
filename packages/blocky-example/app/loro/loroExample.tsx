import { useRef } from "react";
import {
  BlockyEditor,
  makeReactToolbar,
  makeImageBlockPlugin,
  useBlockyController,
  DefaultToolbarMenu,
} from "blocky-react";
import {
  BlockyTextModel,
  DataBaseElement,
  EditorController,
  IPlugin,
} from "blocky-core";
import ImagePlaceholder from "@pkg/components/imagePlaceholder";
import { makeCommandPanelPlugin } from "@pkg/app/plugins/commandPanel";
import { makeAtPanelPlugin } from "@pkg/app/plugins/atPanel";
import { Loro, LoroMap } from "loro-crdt";
import { takeUntil } from "rxjs";

function isPrimitive(value: any) {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function syncDocumentToLoro(doc: DataBaseElement, loroMap: LoroMap) {
  const attribs = doc.getAttributes();

  loroMap.set("t", doc.t);

  const entries = Object.entries(attribs);

  for (const [key, value] of entries) {
    if (isPrimitive(value)) {
      loroMap.set(key, value);
    } else if (Array.isArray(value)) {
      const arr = loroMap.setContainer(key, "List");
      for (let i = 0, len = value.length; i < len; i++) {
        arr.insert(i, value[i]);
      }
    } else if (value instanceof DataBaseElement) {
      const childLoroMap = loroMap.setContainer(key, "Map");
      syncDocumentToLoro(value, childLoroMap);
    } else if (value instanceof BlockyTextModel) {
      const childText = loroMap.setContainer(key, "Text");
      childText.applyDelta(value.delta.ops);
    } else if (typeof value === "object") {
      const childLoroMap = loroMap.setContainer(key, "Map");
      for (const [childKey, childValue] of Object.entries(value)) {
        childLoroMap.set(childKey, childValue);
      }
    }
  }

  if (doc.childrenLength == 0) {
    return;
  }
  const children = loroMap.setContainer("children", "List");
  let ptr = doc.firstChild;
  let counter = 0;
  while (ptr) {
    const subDoc = children.insertContainer(counter, "Map");
    syncDocumentToLoro(ptr as DataBaseElement, subDoc);

    ptr = ptr.nextSibling;
    counter++;
  }
}

function makeLoroPlugin(): IPlugin {
  return {
    name: "rolo",
    onInitialized(context) {
      const loro = new Loro();

      const state = context.editor.state;

      const documentMap = loro.getMap("document");
      syncDocumentToLoro(state.document, documentMap);

      console.log("loro:", loro.toJson());
      console.log("doc:", state.document);

      state.changesetApplied2$
        .pipe(takeUntil(context.dispose$))
        .subscribe((changeset) => {
          console.log("changeset", changeset);
        });
    },
  };
}

function makeEditorPlugins(): IPlugin[] {
  return [
    makeImageBlockPlugin({
      placeholder: ({ setSrc }) => <ImagePlaceholder setSrc={setSrc} />,
    }),
    makeCommandPanelPlugin(),
    makeAtPanelPlugin(),
    makeLoroPlugin(),
  ];
}

function makeController(userId: string): EditorController {
  return new EditorController(userId, {
    title: "Loro",
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

function LoroExample() {
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

export default LoroExample;
