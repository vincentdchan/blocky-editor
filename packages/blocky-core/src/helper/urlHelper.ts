import { Delta } from "blocky-data";

/**
 * Reference: https://stackoverflow.com/a/17773849
 */
const URLRegex =
  /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/g;

export function textToDeltaWithURL(text: string): Delta {
  const delta = new Delta();
  let match: RegExpExecArray | null = null;
  let lastPushIndex = 0;

  /* eslint-disable */
  while (true) {
    match = URLRegex.exec(text);
    if (!match) {
      break;
    }

    const matchText = match[0];

    if (lastPushIndex + matchText.length !== URLRegex.lastIndex) {
      delta.insert(
        text.slice(lastPushIndex, URLRegex.lastIndex - matchText.length)
      );
      lastPushIndex = URLRegex.lastIndex - matchText.length;
    }

    delta.insert(matchText, {
      href: matchText,
    });
    lastPushIndex = URLRegex.lastIndex;
  }

  if (lastPushIndex !== text.length) {
    delta.insert(text.slice(lastPushIndex));
  }

  return delta;
}
