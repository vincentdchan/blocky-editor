import type { BlockElement } from "blocky-data";
import {
  type IBlockDefinition,
  type EditorController,
  type BlockCreatedEvent,
  type Block,
  ContentBlock,
  TryParsePastedDOMEvent,
  BlockDidMountEvent,
} from "blocky-core";
import {
  render as reactRender,
  type ComponentChild,
  createContext,
} from "preact";
import { unmountComponentAtNode } from "preact/compat";

export interface ReactBlockOptions {
  name: string;
  contentClassnames?: string[];
  component: (data: BlockElement) => ComponentChild;
  tryParsePastedDOM?(e: TryParsePastedDOMEvent): BlockElement | void;
}

export interface IReactBlockContext {
  editorController: EditorController;
  blockId: string;
}

export const ReactBlockContext = createContext<IReactBlockContext | undefined>(
  undefined
);

class ReactBlock extends ContentBlock {
  #rendered: HTMLElement | undefined;

  constructor(props: BlockElement, private options: ReactBlockOptions) {
    super(props);
  }

  override blockDidMount(e: BlockDidMountEvent): void {
    super.blockDidMount(e);
    const { contentClassnames } = this.options;
    if (contentClassnames) {
      for (const n of contentClassnames) {
        this.contentContainer.classList.add(n);
      }
    }
  }

  override render() {
    const { component } = this.options;
    this.#rendered = this.contentContainer;
    const editorController = this.editor.controller;
    reactRender(
      <ReactBlockContext.Provider
        value={{ editorController, blockId: this.props.id }}
      >
        {component(this.props)}
      </ReactBlockContext.Provider>,
      this.contentContainer
    );
  }

  dispose() {
    if (this.#rendered) {
      unmountComponentAtNode(this.#rendered);
      this.#rendered = undefined;
    }
    super.dispose();
  }
}

/**
 * This method is used connect between blocky-core and preact.
 * Help to write a block in React's style.
 */
export function makeReactBlock(options: ReactBlockOptions): IBlockDefinition {
  const { name, tryParsePastedDOM } = options;
  return {
    name,
    editable: false,
    onBlockCreated({ blockElement }: BlockCreatedEvent): Block {
      return new ReactBlock(blockElement, options);
    },
    tryParsePastedDOM: tryParsePastedDOM && tryParsePastedDOM.bind(options),
  };
}
