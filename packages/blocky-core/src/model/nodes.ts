
export interface Document {
  t: "doc";
  id: string;
}

export interface Block<T = any> {
  t: "block";
  id: string;
  flags: number;
  data?: T;
}

export interface BlockTextContent {
  t: "block-text-content";
  id: string;
}

export interface Span {
  t: "span";
  id: string;
  flags: number;
  content: string;
}

export type DocNode =
  | Document
  | Block
  | BlockTextContent
  | Span
