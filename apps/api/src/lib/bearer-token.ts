export function readStrictBearerToken(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const match = /^Bearer ([^\s\u0000-\u001f\u007f-\u009f]+)$/u.exec(value);
  return match?.[0] === value ? (match[1] ?? null) : null;
}
