import * as Y from "yjs";
import { type IPlugin, type Editor, type TreeNode } from "blocky-core";

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
      editor.state.newBlockInserted.on((node: TreeNode) => {
        const element = new Y.XmlElement("block");
        const blockDef = editor.registry.block.getBlockDefById(node.blockTypeId);
        if (!blockDef) {
          return;
        }
        element.setAttribute("id", node.id);
        element.setAttribute("type", blockDef.name);

        const prevNode = node.prev;
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
