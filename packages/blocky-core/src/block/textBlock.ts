import { elem } from "blocky-common/es/dom";
import { type IBlockDefinition, BlockContentType, type SpanCreatedEvent } from "./basic";

export const TextBlockName = "text";

export interface ITextBlockOptions {
  level?: number;
}

class TextBlockImpl implements IBlockDefinition {

  public name: string = TextBlockName;
  public type: BlockContentType = BlockContentType.Text;

  constructor(private options?: ITextBlockOptions) {}

  findContentContainer(parent: HTMLElement) {
    return parent.firstChild! as HTMLElement;
  }

  onContainerCreated({ element, clsPrefix }: SpanCreatedEvent) {
    const content = elem("div", `${clsPrefix}-line-content`);

    const level = this.options?.level ?? 0;
    if (level === 1) {
      content.classList.add("blocky-heading1");
    } else if (level === 2) {
      content.classList.add("blocky-heading2");
    } else if (level === 3) {
      content.classList.add("blocky-heading3");
    }

    element.appendChild(content);
  }

}

export function makeTextBlockDefinition(options?: ITextBlockOptions): IBlockDefinition {
  return new TextBlockImpl(options);
}
