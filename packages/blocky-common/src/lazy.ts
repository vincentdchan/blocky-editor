
export function lazy<T>(generator: () => T): () => T {
  let cache: T | undefined;
  return () => {
    if (cache) {
      return cache;
    }
    cache = generator();
    return cache;
  }
}
