import { type Editor, type IPlugin } from "blocky-core";
import { makeReactBlock, DefaultBlockOutline } from "blocky-preact";
import { type RefObject, createRef } from "preact";
import { PureComponent } from "preact/compat";
import Button from "@pkg/components/button";
import "./imageBlock.scss";

export const ImageBlockName = "image";

interface ImageBlockState {
  data?: string;
}

class ImageBlock extends PureComponent<{}, ImageBlockState> {
  #selectorRef: RefObject<HTMLInputElement> = createRef();

  constructor(props: {}) {
    super(props);
    this.state = {};
  }

  private handleUpload = () => {
    this.#selectorRef.current!.click();
  }

  private handleSelectedFileChanged = () => {
    const files = this.#selectorRef.current!.files;
    if (!files || files.length === 0) {
      return;
    }
    const fr = new FileReader();
    fr.onload = () => {
      this.setState({
        data: fr.result as string,
      });
    }
    fr.readAsDataURL(files[0]);
  }

  renderBlockContent() {
    const { data } = this.state;
    if (typeof data === "undefined") {
      return (
        <>
          <Button onClick={this.handleUpload}>Upload</Button>
          <input
            type="file"
            accept=".jpg, .png, .jpeg, .gif, .bmp, .tif, .tiff|image/*"
            className="blocky-image-block-file-selector"
            onChange={this.handleSelectedFileChanged}
            ref={this.#selectorRef}
          />
        </>
      );
    }

    return (
      <img src={data} alt="" />
    );
  }

  render() {
    return (
      <DefaultBlockOutline>
        <div className="blocky-image-block">
          {this.renderBlockContent()}
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
