function stringifyValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean" || value == null) {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function sprintf(format: string, ...args: unknown[]): string {
  let index = 0;

  return format.replace(/%[sdifj]/g, (token) => {
    const value = args[index];
    index += 1;

    if (token === "%d" || token === "%i") {
      return Number(value ?? 0).toString();
    }

    if (token === "%f") {
      return Number(value ?? 0).toString();
    }

    if (token === "%j") {
      try {
        return JSON.stringify(value);
      } catch {
        return '"[Circular]"';
      }
    }

    return stringifyValue(value);
  });
}

export function vsprintf(format: string, args: unknown[]): string {
  return sprintf(format, ...(args || []));
}

export default {
  sprintf,
  vsprintf,
};
