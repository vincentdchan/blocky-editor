import { type TreeNode } from "./tree";
import { DocNode } from "./nodes";

export class ValidateError extends Error {

  constructor(msg: string) {
    super(`[ValidateError] ${msg}`);
  }

}

export function validate(node: TreeNode<DocNode>) {
  if (node.data.t !== "doc") {
    throw new ValidateError(`The root type of node is expected to 'doc', but got '${node.data.t}'`);
  }

  let ptr = node.firstChild;

  while (ptr) {
    if (ptr.data.t !== "block") {
      throw new ValidateError(`The child of 'doc' should be 'block', but got '${ptr.data.t}'`);
    }

    validateBlock(ptr);

    ptr = ptr.next;
  }
}

function validateBlock(blockNode: TreeNode<DocNode>) {
  // TODO: validate block
}
