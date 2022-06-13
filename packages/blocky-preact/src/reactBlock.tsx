import {
  type IBlockDefinition,
  BlockContentType,
  type EditorController,
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

/**
 * This method is used connect between blocky-core and preact.
 * Help to write a block in React's style.
 */
export function makeReactBlock(options: ReactBlockOptions): IBlockDefinition {
  const { name, component } = options;
  let renderedComponent: ComponentChild | undefined;
  return {
    name,
    type: BlockContentType.Custom,
    render(
      container: HTMLElement,
      editorController: EditorController,
      id: string
    ) {
      if (!renderedComponent) {
        renderedComponent = (
          <ReactBlockContext.Provider value={{ editorController, blockId: id }}>
            {component()}
          </ReactBlockContext.Provider>
        );
      }
      reactRender(renderedComponent, container);
    },
    blockWillUnmount(container: HTMLElement) {
      console.log("unmount react block");
      unmountComponentAtNode(container);
    },
  };
}
