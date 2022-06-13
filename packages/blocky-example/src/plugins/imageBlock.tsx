import { type Editor, type IPlugin } from "blocky-core";
import { makeReactBlock, DefaultBlockOutline } from "blocky-preact";
import { Component, type RefObject, createRef } from "preact";
import Button from "@pkg/components/button";
import "./imageBlock.scss";

export const ImageBlockName = "image";

class ImageBlock extends Component {
  #selectorRef: RefObject<HTMLInputElement> = createRef();

  handleUpload = () => {
    this.#selectorRef.current!.click();
  }

  render() {
    return (
      <DefaultBlockOutline>
        <div className="blocky-image-block">
          <Button onClick={this.handleUpload}>Upload</Button>
          <input
            type="file"
            accept=".jpg, .png, .jpeg, .gif, .bmp, .tif, .tiff|image/*"
            className="blocky-image-block-file-selector"
            ref={this.#selectorRef}
          />
        </div>
      </DefaultBlockOutline>
    );
  }
}

export function makeImageBlockPlugin(): IPlugin {
  return {
    name: ImageBlockName,
    onInitialized(editor: Editor) {
      editor.registry.block.register(
        makeReactBlock({
          name: ImageBlockName,
          component: () => <ImageBlock />,
        })
      );
    },
  };
}
