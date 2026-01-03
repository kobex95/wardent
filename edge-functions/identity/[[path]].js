// Identity Handler - 处理 /identity/* 路由
export async function onRequest(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  console.log('Identity Handler - Path:', path, 'Method:', method, 'Params:', params);

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
  if (path === '/identity/connect' || path === '/identity/connect/') {
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

  // 处理注册请求 - 只接受POST
  if (path.startsWith('/identity/accounts/register')) {
    console.log('Register endpoint called, method:', method);

    if (method === 'POST') {
      try {
        const body = await request.json().catch(() => ({}));
        console.log('Register body:', body);

        return new Response(JSON.stringify({
          success: true,
          message: 'User registered successfully',
          email: body.email || 'not provided',
          userId: 'user-' + Date.now(),
        }), { headers, status: 201 });
      } catch (error) {
        console.error('Register error:', error);
        return new Response(
          JSON.stringify({ error: error.message || 'Registration failed' }),
          { headers, status: 500 }
        );
      }
    }

    // 非POST方法返回405
    console.log('Method not allowed:', method);
    return new Response(
      JSON.stringify({
        error: 'Method not allowed',
        method: method,
        allowedMethods: ['POST'],
        path: path
      }),
      { headers, status: 405 }
    );
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
