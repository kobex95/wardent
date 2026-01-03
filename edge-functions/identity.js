// Identity Handler - 处理 /identity/* 路由
export async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // OPTIONS 预检请求
  if (method === 'OPTIONS') {
    return new Response(null, { headers, status: 200 });
  }

  // 处理连接请求
  if (path === '/identity/connect' || path.includes('/identity/connect')) {
    const data = {
      version: '1.59.1',
      name: 'Warden-Worker',
      url: env.SUPABASE_URL || 'https://api.bitwarden.com',
      supportedFeatures: [
        'twoFactor',
        'passwordManager',
        'sendVerificationEmail',
        'hmacVerification',
      ],
      allowedEmails: env.ALLOWED_EMAILS || '*',
      environment: env.APP_ENV || 'development',
    };
    return new Response(JSON.stringify(data), { headers });
  }

  // 处理注册请求
  if (path === '/identity/accounts/register' || path.includes('/identity/accounts/register')) {
    const body = await request.json().catch(() => ({}));

    // 简化版本，直接返回成功
    return new Response(JSON.stringify({
      success: true,
      message: 'User registered successfully',
      email: body.email,
      userId: 'user-' + Date.now(),
    }), { headers, status: 201 });
  }

  // 默认响应
  const response = {
    path: path,
    method: method,
    message: 'Identity endpoint',
    availableRoutes: ['/identity/connect', '/identity/accounts/register'],
    timestamp: new Date().toISOString(),
  };
  return new Response(JSON.stringify(response), { headers });
}
