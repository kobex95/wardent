// Identity Register Handler - 访问路径: /identity/accounts/register
export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;

  console.log('Register endpoint - Method:', method);

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

  // 只接受POST请求
  if (method !== 'POST') {
    return new Response(
      JSON.stringify({
        error: 'Method not allowed',
        method: method,
        allowedMethods: ['POST']
      }),
      { headers, status: 405 }
    );
  }

  // 处理注册请求
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
