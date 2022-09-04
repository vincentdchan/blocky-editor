import { Registry } from "./registry";

export interface Embed {
  container?: Element;
  dispose?(): void;
}

export interface EmbedInitOptions {
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
