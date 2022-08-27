import { type FinalizedChangeset } from "./change";

export class VersionHistory {
  #baseVersion: number;
  #data: FinalizedChangeset[] = [];

  constructor(baseVersion = 0) {
    this.#baseVersion = baseVersion;
  }

  get(index: number): FinalizedChangeset | undefined {
    index -= this.#baseVersion;
    return this.#data[index];
  }

  insert(changeset: FinalizedChangeset) {
    const index = changeset.version;
    if (index < this.#baseVersion) {
      throw new Error(`version ${index} is missing`);
    }
    this.#data[index] = changeset;
  }
}
