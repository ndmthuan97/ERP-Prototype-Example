'use client';
import { Button, Typography, App } from 'antd';
import { GoogleOutlined, DeploymentUnitOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthProvider';
import { toMessage } from '@/lib/api/errors';
import { useState, useEffect } from 'react';

const { Title, Text } = Typography;

export default function LoginPage() {
  const router = useRouter();
  const { login, user } = useAuth();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  // Already logged in → redirect to dashboard
  useEffect(() => {
    if (user) {
      router.replace('/');
    }
  }, [user, router]);

  const onSignIn = async () => {
    try {
      setLoading(true);
      await login();
      router.push('/');
    } catch (error: unknown) {
      message.error(toMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--surface-ground)',
        padding: 16,
      }}
    >
      <div
        style={{
          maxWidth: 960,
          minHeight: 520,
          width: '100%',
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,0.08)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'row',
        }}
      >

        {/* Left half — branding */}
        <div
          style={{
            width: '50%',
            background: 'var(--surface-ground)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 32,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <div
              style={{
                width: 48,
                height: 48,
                background: 'var(--brand)',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 24,
                boxShadow: '0 4px 12px rgba(15,23,42,0.18)',
              }}
            >
              <DeploymentUnitOutlined style={{ color: '#fff', fontSize: 24 }} />
            </div>
            <Title level={2} style={{ marginBottom: 8 }}>WeCare ERP</Title>
            <Text style={{ color: 'var(--surface-muted)', fontSize: 16, marginBottom: 32 }}>Enterprise Resource Planning System</Text>

            {/* Decorative circle */}
            <div
              style={{
                width: 200,
                height: 200,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #d6e4ff 0%, #e8ecf5 100%)',
                boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 24,
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  background: 'linear-gradient(225deg, #bdd0ff 0%, #d6e4ff 100%)',
                  opacity: 0.8,
                }}
              />
            </div>
          </div>
        </div>

        {/* Right half — login form */}
        <div
          style={{
            width: '50%',
            padding: '64px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            background: 'var(--surface-card)',
          }}
        >
          <div style={{ marginBottom: 32 }}>
            <Title level={2} style={{ marginBottom: 8 }}>Sign In</Title>
            <Text style={{ color: 'var(--surface-muted)' }}>Use your Google account to continue</Text>
          </div>

          <Button
            type="primary"
            block
            size="large"
            icon={<GoogleOutlined />}
            loading={loading}
            onClick={onSignIn}
          >
            Sign in with Google
          </Button>
        </div>

      </div>
    </div>
  );
}
