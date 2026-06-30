'use client';
// =============================================================================
// useConfirmAction — reusable hook for destructive action confirmations
// =============================================================================
// Wraps AntD Modal.confirm with consistent patterns:
// - Danger styling by default
// - Loading state tracking
// - Async action support with cleanup

import { useCallback, useState } from 'react';
import { Modal } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';

interface ConfirmOptions {
  title: string;
  content?: string;
  okText?: string;
  cancelText?: string;
  danger?: boolean;
}

interface UseConfirmActionReturn {
  confirm: (options: ConfirmOptions, action: () => Promise<void>) => void;
  loading: boolean;
}

export function useConfirmAction(): UseConfirmActionReturn {
  const [loading, setLoading] = useState(false);

  const confirm = useCallback(
    (options: ConfirmOptions, action: () => Promise<void>) => {
      Modal.confirm({
        title: options.title,
        content: options.content,
        okText: options.okText ?? 'Confirm',
        cancelText: options.cancelText ?? 'Cancel',
        okButtonProps: {
          danger: options.danger !== false,
        },
        icon: <ExclamationCircleOutlined />,
        onOk: async () => {
          setLoading(true);
          try {
            await action();
          } finally {
            setLoading(false);
          }
        },
      });
    },
    [],
  );

  return { confirm, loading };
}
