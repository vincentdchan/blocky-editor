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

function validateBlock(blockNode: BlockyNode) {
  // TODO: validate block
}
