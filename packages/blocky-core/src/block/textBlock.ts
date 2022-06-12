import { elem } from "blocky-common/es/dom";
import { type IBlockDefinition, BlockContentType, type SpanCreatedEvent } from "./basic";

export const TextBlockName = "text";

class TextBlockImpl implements IBlockDefinition {

  public name: string = TextBlockName;
  public type: BlockContentType = BlockContentType.Text;

  findContentContainer(parent: HTMLElement) {
    return parent.firstChild! as HTMLElement;
  }

  onContainerCreated({ element, clsPrefix }: SpanCreatedEvent) {
    const content = elem("div", `${clsPrefix}-line-content`);
    element.appendChild(content);
  }

}

export function makeTextBlockDefinition(): IBlockDefinition {
  return new TextBlockImpl;
}
