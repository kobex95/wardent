// API Handler - 处理 /api/* 路由
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers, status: 200 });
  }

  if (path === '/api/config' || path.includes('/api/config')) {
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
    const data = {
      success: true,
      message: 'Sync endpoint',
      supabaseUrl: env.SUPABASE_URL ? 'configured' : 'missing',
    };
    return new Response(JSON.stringify(data), { headers });
  }

  const response = {
    path: path,
    method: request.method,
    message: 'API endpoint',
    availableRoutes: ['/api/config', '/api/sync'],
    timestamp: new Date().toISOString(),
  };
  return new Response(JSON.stringify(response), { headers });
}
