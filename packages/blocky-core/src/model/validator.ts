import { type BlockyNode } from "./element";

export class ValidateError extends Error {
  constructor(msg: string) {
    super(`[ValidateError] ${msg}`);
  }
}

export function validate(node: BlockyNode) {
  let ptr = node.firstChild;

  while (ptr) {
    validateBlock(ptr);

    ptr = ptr.nextSibling;
  }
}

/* eslint-disable */
function validateBlock(_blockNode: BlockyNode) {
  // TODO: validate block
}
