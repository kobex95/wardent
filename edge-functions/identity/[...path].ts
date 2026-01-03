// Identity Handler - 处理 /identity/* 路由
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
    };
    return new Response(JSON.stringify(data), { headers });
  }

  if (path === '/identity/accounts/register' || path.includes('/identity/accounts/register')) {
    const body = await request.json().catch(() => ({}));
    const data = {
      success: true,
      message: 'Registration endpoint',
      email: body.email || 'not provided',
      supabaseUrl: env.SUPABASE_URL ? 'configured' : 'missing',
    };
    return new Response(JSON.stringify(data), { headers });
  }

  const response = {
    path: path,
    method: request.method,
    message: 'Identity endpoint',
    availableRoutes: ['/identity/connect', '/identity/accounts/register'],
    timestamp: new Date().toISOString(),
  };
  return new Response(JSON.stringify(response), { headers });
}
