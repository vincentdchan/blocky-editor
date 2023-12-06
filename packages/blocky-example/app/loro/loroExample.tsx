import { useRef } from "react";
import {
  makeReactToolbar,
  ImageBlockPlugin,
  useBlockyController,
  DefaultToolbarMenu,
  makeDefaultReactSpanner,
  makeReactBlock,
  DefaultBlockOutline,
  type MenuCommand,
} from "blocky-react";
import {
  BlockyDocument,
  EditorController,
  IPlugin,
  SpannerPlugin,
  TextType,
  bky,
} from "blocky-core";
import BlockyEditorWithTheme from "@pkg/components/editorWithTheme";
import ImagePlaceholder from "@pkg/components/imagePlaceholder";
import { makeCommandPanelPlugin } from "@pkg/app/plugins/commandPanel";
import { makeAtPanelPlugin } from "@pkg/app/plugins/atPanel";
import LoroPlugin from "./loroPlugin";
import { Loro } from "loro-crdt";
import { IdbDao } from "./idbDao";
import LoroBlock from "./loroBlock";
import styles from "./loroExample.module.scss";
import {
  LuType,
  LuHeading1,
  LuHeading2,
  LuHeading3,
  LuImage,
  LuCheckCircle2,
  LuBird,
} from "react-icons/lu";

const loroCommands: MenuCommand[] = [
  {
    title: "Text",
    icon: <LuType />,
    insertText: TextType.Normal,
  },
  {
    title: "Heading1",
    icon: <LuHeading1 />,
    insertText: TextType.Heading1,
  },
  {
    title: "Heading2",
    icon: <LuHeading2 />,
    insertText: TextType.Heading2,
  },
  {
    title: "Heading3",
    icon: <LuHeading3 />,
    insertText: TextType.Heading3,
  },
  {
    title: "Checkbox",
    icon: <LuCheckCircle2 />,
    insertText: TextType.Checkbox,
  },
  {
    title: "Image",
    icon: <LuImage />,
    insertBlock: () => bky.element(ImageBlockPlugin.Name),
  },
  {
    title: "Loro",
    icon: <LuBird />,
    insertBlock: () => bky.element("Loro"),
  },
];

function makeEditorPlugins(): IPlugin[] {
  return [
    new ImageBlockPlugin({
      placeholder: ({ setSrc }) => <ImagePlaceholder setSrc={setSrc} />,
    }),
    new SpannerPlugin({
      factory: makeDefaultReactSpanner({
        commands: loroCommands,
      }),
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
    /**
     * Tell the editor how to render the banner.
     * We use a toolbar written in Preact here.
     */
    toolbarFactory: makeReactToolbar((editorController: EditorController) => {
      return <DefaultToolbarMenu editorController={editorController} />;
    }),

    spellcheck: false,
    collaborativeCursorFactory: (id: string) => ({
      get name() {
        return id;
      },
      get color() {
        return "rgb(235 100 52)";
      },
    }),
  });
}

async function tryReadLoroFromIdb(
  dao: IdbDao
): Promise<Loro<Record<string, unknown>> | undefined> {
  const { snapshot, versions } = await dao.tryReadLoroFromIdb();

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
    const dao = await IdbDao.open("blocky-loro");

    let changeCounter = 0;

    const tempLoro = await tryReadLoroFromIdb(dao);
    const userId = bky.idGenerator.mkUserId();

    const loroPlugin = new LoroPlugin(tempLoro);
    const bc = new BroadcastChannel("test_channel");
    let lastVersion: Uint8Array | undefined;
    loroPlugin.loro.subscribe(async (evt) => {
      if (!evt.local) {
        return;
      }
      const versions = loroPlugin.loro.version();
      const data = loroPlugin.loro.exportFrom(lastVersion);

      bc.postMessage({
        type: "loro",
        id: evt.id,
        userId,
        data,
      });

      await dao.db.add("versions", {
        loroId: evt.id.toString(),
        version: versions,
        data,
        userId,
        createdAt: new Date(),
      });
      lastVersion = versions;
      changeCounter++;

      if (changeCounter > 20) {
        const fullData = loroPlugin.loro.exportFrom();

        await dao.flushFullSnapshot(userId, fullData);

        lastVersion = undefined;
        changeCounter = 0;
        return;
      }
    });

    const handleWipteData = async () => {
      try {
        await dao.wipeAllData();
        bc.postMessage({
          type: "refresh",
        });
        window.location.reload();
      } catch (err) {
        console.error(err);
      }
    };

    const initDoc = loroPlugin.getInitDocumentByLoro();
    const controller = makeController(
      userId,
      [
        ...makeEditorPlugins(),
        loroPlugin,
        {
          name: "loro-block",
          blocks: [
            makeReactBlock({
              name: "Loro",
              component: () => (
                <DefaultBlockOutline>
                  <LoroBlock plugin={loroPlugin} onWipe={handleWipteData} />
                </DefaultBlockOutline>
              ),
            }),
          ],
        },
      ],
      initDoc
    );

    controller.cursorChanged.subscribe((cursor) => {
      bc.postMessage({
        type: "cursor",
        userId,
        data: cursor,
      });
    });

    bc.onmessage = (evt) => {
      if (evt.data.type === "loro") {
        loroPlugin.loro.import(evt.data.data);
      } else if (evt.data.type === "cursor") {
        controller.applyCursorChangedEvent(evt.data.data);
      } else if (evt.data.type === "refresh") {
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    };

    if (!initDoc) {
      console.log("init doc");
      controller.pasteHTMLAtCursor(
        `<p><a href="https://loro.dev/">Loro</a> is a high-performance CRDTs library. It's written in Rust and introduced to the browser via WASM, offering incredible performance.
 Blocky can leverage Loro's data syncing capabilities. By using a simple plugin, you can sync the data of the Blocky editor with Loro.</p>
<p>You can edit this page, and the data will sync to the browser's storage with Loro’s encoding.
 Once you reload the page, the data from the browser will be rendered again.</p>
<p>The most exciting thing is that we can leverage the character of CRDT to implement collaborative editing. Click the blue button below to try collaborative editing between tabs!</p>
<div data-type="Loro">Loro</div>`
      );
    }

    return controller;
  }, []);

  return (
    <div className={styles.editorContainer} ref={containerRef}>
      <BlockyEditorWithTheme
        controller={controller}
        scrollContainer={containerRef}
        autoFocus
      />
    </div>
  );
}

export default LoroExample;
