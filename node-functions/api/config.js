// API Config Handler - 访问路径: /api/config
export async function onRequest(context) {
  const { env } = context;

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

  return new Response(JSON.stringify(config), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
}
