function toUint8(input: string | Uint8Array): Uint8Array {
  if (input instanceof Uint8Array) {
    return input;
  }

  return new TextEncoder().encode(input);
}

function fromUint8(input: Uint8Array): Uint8Array {
  return new Uint8Array(input);
}

export const constants = {
  Z_NO_COMPRESSION: 0,
  Z_BEST_SPEED: 1,
  Z_BEST_COMPRESSION: 9,
  Z_DEFAULT_COMPRESSION: -1,
};

export function gunzipSync(input: string | Uint8Array): Uint8Array {
  // Browser fallback shim: keeps module imports working for almostnode/just-bash.
  // Real compression commands are not fully supported here.
  return fromUint8(toUint8(input));
}

export function gzipSync(input: string | Uint8Array): Uint8Array {
  // Browser fallback shim: keeps module imports working for almostnode/just-bash.
  // Real compression commands are not fully supported here.
  return fromUint8(toUint8(input));
}

export default {
  constants,
  gunzipSync,
  gzipSync,
};
