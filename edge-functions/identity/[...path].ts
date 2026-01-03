import { SupabaseClient } from '../supabase-client.ts';

// Identity Handler - 处理 /identity/* 路由
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

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers, status: 200 });
  }

  // 初始化 Supabase 客户端
  const supabase = env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
    ? new SupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
    : null;

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

  if (path === '/identity/accounts/register' || path.includes('/identity/accounts/register')) {
    if (!supabase) {
      return new Response(
        JSON.stringify({ error: 'Database not configured' }),
        { headers, status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));

    if (!body.email || !body.masterPasswordHash || !body.key) {
      return new Response(
        JSON.stringify({ error: 'Email, password and encryption key are required' }),
        { headers, status: 400 }
      );
    }

    // 检查邮箱是否在白名单
    const allowedEmails = env.ALLOWED_EMAILS || '*';
    if (allowedEmails !== '*' && !isEmailAllowed(body.email, allowedEmails)) {
      return new Response(
        JSON.stringify({ error: 'Email is not allowed' }),
        { headers, status: 403 }
      );
    }

    try {
      // 检查用户是否已存在
      const existingUser = await supabase.getUserByEmail(body.email);
      if (existingUser) {
        return new Response(
          JSON.stringify({ error: 'Email already registered' }),
          { headers, status: 400 }
        );
      }

      // 创建新用户
      const newUser = {
        email: body.email,
        email_verified: false,
        password_hash: body.masterPasswordHash,
        password_salt: body.masterPasswordSalt || '',
        key: body.key,
        private_key: body.private_key || '',
        public_key: body.public_key || '',
      };

      const result = await supabase.createUser(newUser);

      // 确保返回正确的用户ID
      const userId = Array.isArray(result) ? result[0]?.id : result?.id;

      return new Response(
        JSON.stringify({
          success: true,
          message: 'User registered successfully',
          email: body.email,
          userId: userId,
        }),
        { headers, status: 201 }
      );
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message || 'Registration failed' }),
        { headers, status: 500 }
      );
    }
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

// 检查邮箱是否在白名单
function isEmailAllowed(email: string, allowedEmails: string) {
  if (allowedEmails === '*') return true;

  const allowedList = allowedEmails.split(',').map(e => e.trim());
  for (const allowed of allowedList) {
    if (allowed.startsWith('*@')) {
      const domain = allowed.substring(2);
      if (email.endsWith('@' + domain)) return true;
    } else if (email === allowed) {
      return true;
    }
  }
  return false;
}
