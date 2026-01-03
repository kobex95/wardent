// API Handler - 处理 /api/* 路由
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

  // 处理配置请求
  if (path === '/api/config' || path.includes('/api/config')) {
    const config = {
      version: '0.1.0',
      environment: env.APP_ENV || 'development',
      features: ['password-manager', 'sync', 'two-factor'],
      apiUrl: '/api',
      identityUrl: '/identity',
      supabaseConfigured: !!env.SUPABASE_URL,
      jwtConfigured: !!env.JWT_SECRET,
      logLevel: env.LOG_LEVEL || 'info',
    };
    return new Response(JSON.stringify(config), { headers });
  }

  // 处理同步请求
  if (path === '/api/sync' || path.includes('/api/sync')) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Sync not yet implemented',
    }), { headers, status: 501 });
  }

  // 默认响应
  const response = {
    path: path,
    method: method,
    message: 'API endpoint',
    availableRoutes: ['/api/config', '/api/sync'],
    timestamp: new Date().toISOString(),
  };
  return new Response(JSON.stringify(response), { headers });
}
