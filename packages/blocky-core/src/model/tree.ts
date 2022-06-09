
export interface TreeRoot<T> extends TreeNode<T> {

}

export interface TreeNode<T> {
  parent?: TreeNode<T>;
  prev?: TreeNode<T>;
  next?: TreeNode<T>;
  data: T;
  firstChild?: TreeNode<T>,
  lastChild?: TreeNode<T>;
  childrenLength: number;
}

export function forEach<T>(parent: TreeNode<T>, f: (f: TreeNode<T>) => void) {
  let ptr: TreeNode<T> | undefined = parent.firstChild;
  while (ptr) {
    f(ptr);
    ptr = ptr.next;
  }
}

export function map<T, R>(childrenStart: TreeNode<T>, f: (f: TreeNode<T>) => R): R[] {
  const result: R[] = [];
  let ptr: TreeNode<T> | undefined = childrenStart;
  while (ptr) {
    result.push(f(ptr));
    ptr = ptr.next;
  }
  return result;
}

export function childrenToArray<T>(childrenStart: TreeNode<T>): TreeNode<T>[] {
  return map<T, TreeNode<T>>(childrenStart, (node) => node);
}

export function insertAfter<T>(parent: TreeNode<T>, node: TreeNode<T>, after?: TreeNode<T>) {
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

export function appendChild<T>(parent: TreeNode<T>, node: TreeNode<T>) {
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

export function createRoot<T>(data: T): TreeRoot<T> {
  return {
    data,
    childrenLength: 0,
  };
}

export function createNode<T>(data: T): TreeNode<T> {
  return {
    data,
    childrenLength: 0,
  };
}

export function removeNode<T>(node: TreeNode<T>) {
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
