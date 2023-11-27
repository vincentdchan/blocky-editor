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
import { BlockyDocument, EditorController, IPlugin } from "blocky-core";
import ImagePlaceholder from "@pkg/components/imagePlaceholder";
import { makeCommandPanelPlugin } from "@pkg/app/plugins/commandPanel";
import { makeAtPanelPlugin } from "@pkg/app/plugins/atPanel";
import LoroPlugin from "./loroPlugin";
import { openDB, IDBPDatabase } from "idb";
import { Loro } from "loro-crdt";
import styles from "./loroExample.module.scss";

function makeEditorPlugins(): IPlugin[] {
  return [
    makeImageBlockPlugin({
      placeholder: ({ setSrc }) => <ImagePlaceholder setSrc={setSrc} />,
    }),
    makeCommandPanelPlugin(),
    makeAtPanelPlugin(),
  ];
}

function makeController(
  userId: string,
  plugins: IPlugin[],
  doc?: BlockyDocument
): EditorController {
  return new EditorController(userId, {
    title: doc ? undefined : "Loro",
    document: doc,
    plugins,
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

async function tryReadLoroFromIdb(
  db: IDBPDatabase
): Promise<Loro<Record<string, unknown>> | undefined> {
  let snapshot: any;
  let versions: any;
  {
    const tx = db.transaction("snapshot", "readonly");

    // find latest snapshot with creatAt
    const snapshotCursor = await tx
      .objectStore("snapshot")
      .index("createdAt")
      .openCursor(null, "prev");

    snapshot = snapshotCursor?.value;

    tx.commit();
  }

  const tx = db.transaction("versions", "readonly");

  versions = await tx.objectStore("versions").index("loroId").getAll();

  tx.commit();

  if (snapshot || versions.length > 0) {
    const loro = new Loro();
    if (snapshot) {
      loro.import(snapshot.data);
    }

    loro.importUpdateBatch(versions.map((v: any) => v.data));

    return loro;
  }
}

function LoroExample() {
  const containerRef = useRef<HTMLDivElement>(null);

  const controller = useBlockyController(async () => {
    const db = await openDB("blocky-loro", 1, {
      upgrade(db) {
        const store = db.createObjectStore("versions", {
          // The 'id' property of the object will be the key.
          keyPath: "id",
          // If it isn't explicitly set, create a value by auto incrementing.
          autoIncrement: true,
        });
        store.createIndex("loroId", "loroId");
        const snapshotStore = db.createObjectStore("snapshot", {
          // The 'id' property of the object will be the key.
          keyPath: "id",
          // If it isn't explicitly set, create a value by auto incrementing.
          autoIncrement: true,
        });
        snapshotStore.createIndex("createdAt", "createdAt");
      },
    });

    const loro = await tryReadLoroFromIdb(db);

    let changeCounter = 0;

    const loroPlugin = new LoroPlugin(loro);
    let lastVersion: Uint8Array | undefined;
    loroPlugin.loro.subscribe(async (evt) => {
      if (changeCounter > 20) {
        const fullData = loroPlugin.loro.exportFrom();
        console.log("fullData");
        await db.add("snapshot", {
          data: fullData,
          createdAt: new Date(),
        });

        const tx = db.transaction("versions", "readwrite");
        // delete all versions

        await tx.objectStore("versions").clear();

        await tx.done;

        lastVersion = undefined;
        changeCounter = 0;
        return;
      }
      const versions = loroPlugin.loro.version();
      const data = loroPlugin.loro.exportFrom(lastVersion);
      await db.add("versions", {
        loroId: evt.id.toString(),
        version: versions,
        data,
        createdAt: new Date(),
      });
      lastVersion = versions;
      changeCounter++;
    });

    const initDoc = loro ? LoroPlugin.getInitDocumentByLoro(loro) : undefined;
    const controller = makeController(
      "user",
      [...makeEditorPlugins(), loroPlugin],
      initDoc
    );

    if (!loro) {
      controller.pasteHTMLAtCursor(
        `Loro is a high-performance CRDTs library. It's written in Rust and introduced to the browser via WASM, offering incredible performance.
Blocky can leverage Loro's data syncing capabilities. By using a simple plugin, you can sync the data of the Blocky editor with Loro.
You can edit this page, and the data will sync to the browser's storage with Loro’s encoding.
Once you reload the page, the data from the browser will be rendered again.`
      );
    }

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
