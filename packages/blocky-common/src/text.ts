
export function isWhiteSpace(text: string): boolean {
  if (text === " ") {
    return true;
  }

  if (text.length === 1 && text.charCodeAt(0) === 160) {
    return true;
  }

  return false;
}
