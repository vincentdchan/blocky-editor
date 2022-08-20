import { Registry } from "./registry";

/**
 * Embed is an element which is not editable.
 * Such as an calendar reference.
 */
export interface Embed {
  type: string;
  onEmbedCreated: (elem: HTMLElement) => void;
  dispose?: () => void;
}

export class EmbedRegistry extends Registry<Embed> {
  readonly embeds: Map<string, Embed> = new Map();

  register(embed: Embed) {
    this.ensureUnsealed();
    this.embeds.set(embed.type, embed);
  }
}
