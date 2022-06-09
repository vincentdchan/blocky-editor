
const a = "a".charCodeAt(0);
const z = "z".charCodeAt(0);

const A = "A".charCodeAt(0);
const Z = "Z".charCodeAt(0);

const n0 = "0".charCodeAt(0);
const n9 = "9".charCodeAt(0);

function insertCodeBetween(begin: number, end: number, candidates: string[]) {
  for (let i = begin; i <= end; i++) {
    candidates.push(String.fromCharCode(i));
  }
}

const candidates: string[] = [];
insertCodeBetween(a, z, candidates);
insertCodeBetween(A, Z, candidates);
insertCodeBetween(n0, n9, candidates);

function randomStr(count: number) {
  let result = "";
  for (let i = 0; i < count; i++) {
    let rand = (Math.random() * candidates.length) | 0;
    result += candidates[rand];
  }
  return result;
}

export function mkAnonymousId(): string {
  return "Anm-" + randomStr(8);
}

export function mkDocId(): string {
  return "Doc-" + randomStr(12);
}

export function mkCardId(): string {
  return "Crd-" + randomStr(12);
}

export function mkBlockId(): string {
  return "Blk-" + randomStr(12);
}

export function isBlockId(id: string): boolean {
  return id.startsWith("Blk-");
}

export function mkClientId(userId: string): string {
  return userId + "/CLT" + "-" + randomStr(4);
}

export function mkUserId(): string {
  return "Usr-" + randomStr(12);
}

export function mkSpanId(): string {
  return "Spn-" + randomStr(12);
}

export function isSpanId(id: string): boolean {
  return id.startsWith("Spn-");
}
