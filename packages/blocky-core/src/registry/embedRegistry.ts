import { Registry } from "./registry";

export class Embed {
  container: Element;
  element: Element;
  record: Record<string, any>;

  constructor(options: EmbedInitOptions) {
    this.container = options.container;
    this.element = options.element;
    this.record = options.record;
  }

  dispose?(): void;
}

export interface EmbedInitOptions {
  container: HTMLElement;
  element: HTMLElement;
  record: any;
}

/**
 * Embed is an element which is not editable.
 * Such as an calendar reference.
 */
export interface EmbedDefinition {
  type: string;
  new (options: EmbedInitOptions): Embed | void;
}

export class EmbedRegistry extends Registry<EmbedDefinition> {
  readonly embeds: Map<string, EmbedDefinition> = new Map();

  register(embed: EmbedDefinition) {
    this.ensureUnsealed();
    this.embeds.set(embed.type, embed);
  }
}
