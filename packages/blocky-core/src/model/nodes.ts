
export interface Document {
  t: "doc";
  id: string;
}

export interface BlockData<T = any> {
  t: "block";
  id: string;
  flags: number;
  data?: T;
}

export type DocNode =
  | Document
  | BlockData
