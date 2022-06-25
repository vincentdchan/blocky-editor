export interface AttributesObject {
  [key: string]: any;
}

export interface BlockyNode {
  nodeName: string;
  parent: BlockyNode | null;
  nextSibling: BlockyNode | null;
  prevSibling: BlockyNode | null;
  firstChild: BlockyNode | null;
  lastChild: BlockyNode | null;
  childrenLength: number;
}
