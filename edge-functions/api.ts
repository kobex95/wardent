import { SupabaseClient } from './supabase-client.ts';

// API Handler - 处理 /api/* 路由
export async function onRequest(context: any) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

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

  // 初始化 Supabase 客户端
  const supabase = env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
    ? new SupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
    : null;

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
    if (!supabase) {
      return new Response(
        JSON.stringify({ error: 'Database not configured' }),
        { headers, status: 500 }
      );
    }

    try {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Authorization header required' }),
          { headers, status: 401 }
        );
      }

      const sessionToken = authHeader.replace('Bearer ', '');
      const session = await supabase.validateSession(sessionToken);

      if (!session) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired session' }),
          { headers, status: 401 }
        );
      }

      // 获取用户的密码数据
      const ciphers = await supabase.getCiphers(session.user_id);

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            profile: {
              name: session.user_id,
              email: session.user_id,
              premium: false,
            },
            ciphers: ciphers,
            collections: [],
            folders: [],
            domains: [],
          },
          syncDate: new Date().toISOString(),
        }),
        { headers }
      );
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message || 'Sync failed' }),
        { headers, status: 500 }
      );
    }
  }

  // 默认响应
  const response = {
    path: path,
    method: request.method,
    message: 'API endpoint',
    availableRoutes: ['/api/config', '/api/sync'],
    timestamp: new Date().toISOString(),
  };
  return new Response(JSON.stringify(response), { headers });
}
