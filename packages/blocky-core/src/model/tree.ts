import { type IModelChild } from "./element";

export interface TreeRoot extends TreeNode {

}

export interface TreeNode {
  parent?: TreeNode;
  prev?: TreeNode;
  next?: TreeNode;
  id: string;
  blockTypeId: number;
  data?: IModelChild;
  firstChild?: TreeNode,
  lastChild?: TreeNode;
  childrenLength: number;
}

export function forEach(parent: TreeNode, f: (f: TreeNode) => void) {
  let ptr: TreeNode | undefined = parent.firstChild;
  while (ptr) {
    f(ptr);
    ptr = ptr.next;
  }
}

export function map<T, R>(childrenStart: TreeNode, f: (f: TreeNode) => R): R[] {
  const result: R[] = [];
  let ptr: TreeNode | undefined = childrenStart;
  while (ptr) {
    result.push(f(ptr));
    ptr = ptr.next;
  }
  return result;
}

export function childrenToArray<T>(childrenStart: TreeNode): TreeNode[] {
  return map<T, TreeNode>(childrenStart, (node) => node);
}

export function insertAfter<T>(parent: TreeNode, node: TreeNode, after?: TreeNode) {
  node.parent = parent;
  if (!after) {
    if (parent.firstChild) {
      parent.firstChild.prev = node;
    }

    if (!parent.lastChild) {
      parent.lastChild = node;
    }

    node.next = parent.firstChild;
    node.prev = undefined;
    
    parent.firstChild = node;
  } else {
    if (after.next) {
      after.next.prev = node;
    }

    node.next = after.next;
    node.prev = after;
    after.next = node;

    if (parent.lastChild === after) {
      parent.lastChild = node;
    }
  }

  parent.childrenLength++;
}

export function appendChild<T>(parent: TreeNode, node: TreeNode) {
  if (!parent.firstChild) {
    parent.firstChild = node;
  }

  if (parent.lastChild) {
    parent.lastChild.next = node;
  }

  node.prev = parent.lastChild;
  node.next = undefined;
  node.parent = parent;
  parent.lastChild = node;
  parent.childrenLength++;
}

export function createRoot(id: string, blockTypeId: number = 0): TreeRoot {
  return {
    id,
    blockTypeId,
    childrenLength: 0,
  };
}

export function createNode(id: string, blockTypeId: number = 0, data: IModelChild): TreeNode {
  return {
    id,
    blockTypeId,
    data,
    childrenLength: 0,
  };
}

export function removeNode(node: TreeNode) {
  const { parent } = node;
  if (!parent) {
    return;
  }

  if (node.prev) {
    node.prev.next = node.next;
  }

  if (node.next) {
    node.next.prev = node.prev;
  }

  if (parent.firstChild === node) {
    parent.firstChild = node.next;
  }

  if (parent.lastChild === node) {
    parent.lastChild = node.prev;
  }

  node.prev = undefined;
  node.next = undefined;
  parent.childrenLength--;
}
