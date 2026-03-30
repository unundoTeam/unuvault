const browserApiEnv = {
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
} as const;

export function createBrowserApiFetch(fetcher: typeof fetch = fetch) {
  const baseUrl = browserApiEnv.NEXT_PUBLIC_API_BASE_URL ?? "";

  return (input: string, init?: RequestInit) => fetcher(`${baseUrl}${input}`, init);
}
