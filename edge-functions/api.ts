// API Handler - 处理 /api/* 路由
// 文件名：api/[...path].ts 或 api.ts
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
    if (path === '/api/config' || path.includes('/api/config')) {
      // 配置端点
      const config = {
        version: '0.1.0',
        environment: env.APP_ENV || 'development',
        features: ['password-manager', 'sync', 'two-factor'],
        apiUrl: '/api',
        identityUrl: '/identity',
      };
      return new Response(JSON.stringify(config), { headers });
    }

    if (path === '/api/sync' || path.includes('/api/sync')) {
      // 同步端点（示例）
      const data = {
        success: true,
        message: 'Sync endpoint - ready for implementation',
        supabaseUrl: supabaseUrl ? 'configured' : 'missing',
      };
      return new Response(JSON.stringify(data), { headers });
    }

    // 默认响应 - 任何 /api 开头的请求
    const response = {
      path: path,
      method: request.method,
      message: 'API endpoint',
      availableRoutes: ['/api/config', '/api/sync'],
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
