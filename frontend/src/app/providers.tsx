'use client';
import '@ant-design/v5-patch-for-react-19';
// =============================================================================
// PROVIDERS — wraps all client providers (React Query + AntD + Auth)
// =============================================================================
import { ConfigProvider, App as AntdApp, message as antdMessage } from 'antd';
import enUS from 'antd/locale/en_US';
import { QueryClient, QueryClientProvider, MutationCache, QueryCache } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth/AuthProvider';
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
      <ConfigProvider
        locale={enUS}
        theme={{
          token: {
            colorPrimary: '#1677ff',
            colorSuccess: '#52c41a',
            colorWarning: '#faad14',
            colorError: '#ff4d4f',
            colorBgLayout: '#f0f2f5',
            borderRadius: 8,
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          },
          components: {
            Card: { borderRadiusLG: 12 },
            Table: { headerBg: '#fafafa' },
          },
        }}
      >
        <AntdApp>
          <AuthProvider>{children}</AuthProvider>
        </AntdApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
