// Identity Handler - 处理 /identity/* 路由
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // Supabase 配置
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_ANON_KEY;

  // 响应头
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // OPTIONS 预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers, status: 200 });
  }

  try {
    // 根据路由处理请求
    if (path === '/identity/connect' || path.includes('/identity/connect')) {
      // 连接端点
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
      };
      return new Response(JSON.stringify(data), { headers });
    }

    if (path === '/identity/accounts/register' || path.includes('/identity/accounts/register')) {
      // 注册端点（示例）
      const body = await request.json().catch(() => ({}));
      const data = {
        success: true,
        message: 'Registration endpoint - ready for implementation',
        email: body.email || 'not provided',
        supabaseUrl: supabaseUrl ? 'configured' : 'missing',
      };
      return new Response(JSON.stringify(data), { headers });
    }

    // 默认响应 - 任何 /identity 开头的请求
    const response = {
      path: path,
      method: request.method,
      message: 'Identity endpoint',
      availableRoutes: ['/identity/connect', '/identity/accounts/register'],
      timestamp: new Date().toISOString(),
    };
    return new Response(JSON.stringify(response), { headers });

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers, status: 500 }
    );
  }
}
