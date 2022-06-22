import { type TreeNode } from "./tree";

export class ValidateError extends Error {

  constructor(msg: string) {
    super(`[ValidateError] ${msg}`);
  }

}

export function validate(node: TreeNode) {
  let ptr = node.firstChild;

  while (ptr) {
    validateBlock(ptr);

    ptr = ptr.next;
  }
}

function validateBlock(blockNode: TreeNode) {
  // TODO: validate block
}
