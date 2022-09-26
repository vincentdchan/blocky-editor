import type { BlockElement } from "blocky-data";
import {
  type IBlockDefinition,
  type EditorController,
  ContentBlock,
  TryParsePastedDOMEvent,
} from "blocky-core";
import {
  render as reactRender,
  type ComponentChild,
  createContext,
} from "preact";
import { unmountComponentAtNode } from "preact/compat";

export interface ReactBlockRenderProps {
  controller: EditorController;
  blockElement: BlockElement;
}

export interface ReactBlockOptions {
  name: string;
  component: (props: ReactBlockRenderProps) => ComponentChild;
  tryParsePastedDOM?(e: TryParsePastedDOMEvent): BlockElement | void;
}

export interface IReactBlockContext {
  editorController: EditorController;
  blockId: string;
}

export const ReactBlockContext = createContext<IReactBlockContext | undefined>(
  undefined
);

/**
 * This method is used connect between blocky-core and preact.
 * Help to write a block in React's style.
 */
export function makeReactBlock(options: ReactBlockOptions): IBlockDefinition {
  const { name, tryParsePastedDOM } = options;
  return class ReactBlock extends ContentBlock {
    static Name = name;
    static Editable = false;
    static TryParsePastedDOM =
      tryParsePastedDOM && tryParsePastedDOM.bind(options);

    #rendered: HTMLElement | undefined;

    override render() {
      const { component } = options;
      this.#rendered = this.contentContainer;
      const editorController = this.editor.controller;
      reactRender(
        <ReactBlockContext.Provider
          value={{ editorController, blockId: this.props.id }}
        >
          {component({
            controller: this.editor.controller,
            blockElement: this.props,
          })}
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
  };
}
