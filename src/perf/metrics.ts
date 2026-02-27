export function markPerf(name: string): void {
  if (typeof performance === "undefined") {
    return;
  }

  performance.mark(name);
}

export function measurePerf(name: string, start: string, end: string): void {
  if (typeof performance === "undefined") {
    return;
  }

  performance.measure(name, start, end);
}
