'use client';
import { Form, Input, Button, Typography, App } from 'antd';
import { MailOutlined, LockOutlined, LoginOutlined, DeploymentUnitOutlined } from '@ant-design/icons';
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

  const onFinish = async (values: { email: string; password: string }) => {
    try {
      setLoading(true);
      await login(values.email, values.password);
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
        background: '#f5f7fa',
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
            background: 'linear-gradient(135deg, #f0f5ff 0%, #e6ecf5 100%)',
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
                background: '#1677ff',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 24,
                boxShadow: '0 4px 12px rgba(22,119,255,0.3)',
              }}
            >
              <DeploymentUnitOutlined style={{ color: '#fff', fontSize: 24 }} />
            </div>
            <Title level={2} style={{ marginBottom: 8 }}>WeCare ERP</Title>
            <Text style={{ color: '#8c8c8c', fontSize: 16, marginBottom: 32 }}>Enterprise Resource Planning System</Text>

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
            background: '#fff',
          }}
        >
          <div style={{ marginBottom: 32 }}>
            <Title level={2} style={{ marginBottom: 8 }}>Sign In</Title>
            <Text style={{ color: '#8c8c8c' }}>Enter your credentials to continue</Text>
          </div>

          <Form
            layout="vertical"
            onFinish={onFinish}
            size="large"
          >
            <Form.Item
              name="email"
              rules={[
                { required: true, message: 'Please enter your email' },
                { type: 'email', message: 'Invalid email format' }
              ]}
            >
              <Input prefix={<MailOutlined style={{ color: '#8c8c8c' }} />} placeholder="admin@gmail.com" />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: 'Please enter your password' }]}
            >
              <Input.Password prefix={<LockOutlined style={{ color: '#8c8c8c' }} />} placeholder="Password" />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
              <Button
                type="primary"
                htmlType="submit"
                block
                icon={<LoginOutlined />}
                loading={loading}
              >
                Sign In
              </Button>
            </Form.Item>
          </Form>
        </div>

      </div>
    </div>
  );
}
