'use client';
import '@ant-design/v5-patch-for-react-19';
// =============================================================================
// PROVIDERS — wraps all client providers (React Query + AntD + Auth)
// =============================================================================
import { App as AntdApp, message as antdMessage } from 'antd';
import { QueryClient, QueryClientProvider, MutationCache, QueryCache } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth/AuthProvider';
import { ThemeConfigProvider } from '@/lib/theme/ThemeConfigContext';
import { toMessage } from '@/lib/api/errors';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            staleTime: 30_000,
          },
        },
        queryCache: new QueryCache({
          onError: (error, query) => {
            // Only show global toast for queries without explicit onError
            if (!query.options.meta?.skipGlobalErrorHandler) {
              antdMessage.error(toMessage(error));
            }
          },
        }),
        mutationCache: new MutationCache({
          onError: (error, _variables, _context, mutation) => {
            // Only show global toast for mutations without explicit onError
            if (!mutation.options.onError) {
              antdMessage.error(toMessage(error));
            }
          },
        }),
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeConfigProvider>
        <AntdApp>
          <AuthProvider>{children}</AuthProvider>
        </AntdApp>
      </ThemeConfigProvider>
    </QueryClientProvider>
  );
}
