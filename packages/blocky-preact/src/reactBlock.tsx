import {
  type IBlockDefinition,
  type EditorController,
  type BlockData,
  type BlockCreatedEvent,
  Block,
} from "blocky-core";
import {
  render as reactRender,
  type ComponentChild,
  createContext,
} from "preact";
import { unmountComponentAtNode } from "preact/compat";

export interface ReactBlockOptions {
  name: string;
  component: () => ComponentChild;
}

export interface IReactBlockContext {
  editorController: EditorController;
  blockId: string;
}

export const ReactBlockContext = createContext<IReactBlockContext | undefined>(
  undefined
);

class ReactBlock extends Block {

  #rendered: HTMLElement | undefined;

  constructor(props: BlockData, private options: ReactBlockOptions) {
    super(props);
  }

  override render(container: HTMLElement) {
    const { component } = this.options;
    this.#rendered = container;
    const editorController = this.editor.controller;
    reactRender(
      <ReactBlockContext.Provider value={{ editorController, blockId: this.props.id }}>
        {component()}
      </ReactBlockContext.Provider>,
      container
    );
  }

  dispose() {
    if (this.#rendered) {
      unmountComponentAtNode(this.#rendered);
      this.#rendered = undefined;;
    }
    super.dispose();
  }

}

/**
 * This method is used connect between blocky-core and preact.
 * Help to write a block in React's style.
 */
export function makeReactBlock(options: ReactBlockOptions): IBlockDefinition {
  const { name } = options;
  return {
    name,
    editable: false,
    onBlockCreated({ model }: BlockCreatedEvent): Block {
      return new ReactBlock(model, options);
    },
  };
}
