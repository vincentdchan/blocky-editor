
const codeA = 65;
const codeZ = 90;

export function isUpperCase(char: string): boolean {
  const code = char.charCodeAt(0);
  return code >= codeA && code <= codeZ;
}
