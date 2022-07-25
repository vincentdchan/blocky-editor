/**
 * Modified from: https://github.com/jensyt/imurmurhash-js/blob/master/imurmurhash.js
 */
export function hashIntArrays(
  data: number[] | readonly number[],
  seed?: number
): number {
  let h1 = seed ?? 0;
  let k1 = 0;
  let rem = 0;
  let len = data.length;

  let i = 0;
  switch (rem) {
    case 0:
      k1 ^= len > i ? data[i++] & 0xffff : 0;
    case 1:
      k1 ^= len > i ? (data[i++] & 0xffff) << 8 : 0;
    case 2:
      k1 ^= len > i ? (data[i++] & 0xffff) << 16 : 0;
    case 3:
      k1 ^= len > i ? (data[i] & 0xff) << 24 : 0;
      k1 ^= len > i ? (data[i++] & 0xff00) >> 8 : 0;
  }

  rem = (len + rem) & 3; // & 3 is same as % 4
  len -= rem;
  if (len > 0) {
    while (1) {
      k1 = (k1 * 0x2d51 + (k1 & 0xffff) * 0xcc9e0000) & 0xffffffff;
      k1 = (k1 << 15) | (k1 >>> 17);
      k1 = (k1 * 0x3593 + (k1 & 0xffff) * 0x1b870000) & 0xffffffff;

      h1 ^= k1;
      h1 = (h1 << 13) | (h1 >>> 19);
      h1 = (h1 * 5 + 0xe6546b64) & 0xffffffff;

      if (i >= len) {
        break;
      }

      k1 =
        (data[i++] & 0xffff) ^
        ((data[i++] & 0xffff) << 8) ^
        ((data[i++] & 0xffff) << 16);
      const top = data[i++];
      k1 ^= ((top & 0xff) << 24) ^ ((top & 0xff00) >> 8);
    }

    k1 = 0;
    switch (rem) {
      case 3:
        k1 ^= (data[i + 2] & 0xffff) << 16;
      case 2:
        k1 ^= (data[i + 1] & 0xffff) << 8;
      case 1:
        k1 ^= data[i] & 0xffff;
    }
  }

  if (k1 > 0) {
    k1 = (k1 * 0x2d51 + (k1 & 0xffff) * 0xcc9e0000) & 0xffffffff;
    k1 = (k1 << 15) | (k1 >>> 17);
    k1 = (k1 * 0x3593 + (k1 & 0xffff) * 0x1b870000) & 0xffffffff;
    h1 ^= k1;
  }

  h1 ^= len;

  h1 ^= h1 >>> 16;
  h1 = (h1 * 0xca6b + (h1 & 0xffff) * 0x85eb0000) & 0xffffffff;
  h1 ^= h1 >>> 13;
  h1 = (h1 * 0xae35 + (h1 & 0xffff) * 0xc2b20000) & 0xffffffff;
  h1 ^= h1 >>> 16;

  return h1 >>> 0;
}
