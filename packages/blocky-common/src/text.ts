export function isWhiteSpace(text: string): boolean {
  if (text === " ") {
    return true;
  }

  if (text.length === 1 && text.charCodeAt(0) === 160) {
    return true;
  }

  return false;
}

// TODO: optimize
export function removeLineBreaks(content: string | null): string {
  if (content === null) {
    return "";
  }
  return content.replaceAll(/(\r|\n|\t)/g, "");
}
