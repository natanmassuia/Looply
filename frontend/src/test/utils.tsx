import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// Test harness: retries disabled so failure assertions are deterministic and
// no request is ever replayed against a mock.
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function wrapWithQueryClient(children: ReactNode): { client: QueryClient; wrapper: ReactNode } {
  const client = createTestQueryClient();
  return { client, wrapper: <QueryClientProvider client={client}>{children}</QueryClientProvider> };
}
