export function now(): string {
  return new Date().toISOString();
}

export function nowMs(): number {
  return Date.now();
}
