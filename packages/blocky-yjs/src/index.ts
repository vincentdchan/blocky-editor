import * as Y from "yjs";
import { type IPlugin, type Editor, type BlockElement } from "blocky-core";

export interface IYjsPluginOptions {
  doc: Y.Doc,
}

export function makeYjsPlugin(options: IYjsPluginOptions): IPlugin {
  const { doc } = options;
  const docFragment = doc.getXmlFragment();
  const nodeToY = new Map<string, Y.XmlElement>();
  return {
    name: "yjs",
    onInitialized(editor: Editor) {
      editor.state.newBlockInserted.on((node: BlockElement) => {
        const blockDef = editor.registry.block.getBlockDefByName(node.blockName);
        if (!blockDef) {
          return;
        }
        const element = new Y.XmlElement(blockDef.name);
        element.setAttribute("id", node.id);

        const prevNode = node.prevSibling as BlockElement | null;
        if (prevNode) {
          const prevYNode = nodeToY.get(prevNode.id);
          if (!prevYNode) {
            return;
          }
          docFragment.insertAfter(prevYNode, [element]);
        } else {
          docFragment.push([element]);
        }
      });
    },
  };
}
