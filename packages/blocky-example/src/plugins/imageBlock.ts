import { type Editor, type IPlugin, type IBlockDefinition, BlockContentType } from "blocky-core";

export const ImageBlockName = "image";

class ImageBlockDefinition implements IBlockDefinition {

  public name: string = ImageBlockName;
  public type: BlockContentType = BlockContentType.Custom;

}

export function makeImageBlockPlugin(): IPlugin {
  return {
    name: ImageBlockName,
    onInitialized(editor: Editor) {
      editor.registry.block.register(new ImageBlockDefinition);
    },
  };
}
