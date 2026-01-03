// EdgeOne Edge Functions API Handler 示例
// 负责处理 API 请求并转发到 Rust/WASM 模块

export async function handleRequest(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS 头
    const corsHeaders = {
        'Access-Control-Allow-Origin': env.CORS_ALLOWED_ORIGINS || '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        if (path.startsWith('/identity')) {
            return await handleIdentity(request, env, corsHeaders);
        } else if (path.startsWith('/api')) {
            return await handleApi(request, env, corsHeaders);
        } else {
            return new Response('Not Found', { status: 404, headers: corsHeaders });
        }
    } catch (error) {
        console.error('Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

async function handleIdentity(request, env, headers) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (path === '/identity/accounts/prelogin' && method === 'POST') {
        return await preLogin(request, env, headers);
    } else if (path === '/identity/connect/token' && method === 'POST') {
        return await token(request, env, headers);
    } else {
        return new Response('Not Found', { status: 404, headers });
    }
}

async function handleApi(request, env, headers) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (path === '/api/sync' && method === 'GET') {
        return await getSyncData(request, env, headers);
    } else if (path === '/api/config' && method === 'GET') {
        return await getConfig(request, env, headers);
    } else {
        return new Response('Not Found', { status: 404, headers });
    }
}

async function preLogin(request, env, headers) {
    const body = await request.json();
    const email = body.email;

    if (!isEmailAllowed(email, env)) {
        return new Response(JSON.stringify({ error: 'Email not allowed' }), {
            status: 403,
            headers: { ...headers, 'Content-Type': 'application/json' }
        });
    }

    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}`, {
        headers: {
            'apikey': env.SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
        }
    });

    const users = await response.json();

    return new Response(JSON.stringify({
        Kdf: 0,
        KdfIterations: users.length > 0 ? (users[0].password_iterations || 100000) : 100000
    }), { headers: { ...headers, 'Content-Type': 'application/json' } });
}

async function token(request, env, headers) {
    const body = await request.json();
    const { email, password } = body;

    if (!isEmailAllowed(email, env)) {
        return new Response(JSON.stringify({ error: 'Email not allowed' }), {
            status: 403,
            headers: { ...headers, 'Content-Type': 'application/json' }
        });
    }

    const userResponse = await fetch(
        `${env.SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}`,
        {
            headers: {
                'apikey': env.SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
            }
        }
    );

    const users = await userResponse.json();

    if (users.length === 0 || !await verifyPassword(password, users[0].password_hash)) {
        return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
            status: 401,
            headers: { ...headers, 'Content-Type': 'application/json' }
        });
    }

    const user = users[0];
    const accessToken = generateAccessToken(user, env.JWT_SECRET);

    return new Response(JSON.stringify({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 86400,
    }), { headers: { ...headers, 'Content-Type': 'application/json' } });
}

async function getSyncData(request, env, headers) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { ...headers, 'Content-Type': 'application/json' }
        });
    }

    const token = authHeader.substring(7);
    const user = await verifyToken(token, env.JWT_SECRET);

    if (!user) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
            status: 401,
            headers: { ...headers, 'Content-Type': 'application/json' }
        });
    }

    const [ciphersResponse, foldersResponse] = await Promise.all([
        fetch(`${env.SUPABASE_URL}/rest/v1/ciphers?user_id=eq.${user.id}&deleted_date=is.null`, {
            headers: {
                'apikey': env.SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
            }
        }),
        fetch(`${env.SUPABASE_URL}/rest/v1/folders?user_id=eq.${user.id}`, {
            headers: {
                'apikey': env.SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
            }
        })
    ]);

    const ciphers = await ciphersResponse.json();
    const folders = await foldersResponse.json();

    return new Response(JSON.stringify({
        Profile: user,
        Ciphers: ciphers,
        Folders: folders,
    }), { headers: { ...headers, 'Content-Type': 'application/json' } });
}

async function getConfig(request, env, headers) {
    return new Response(JSON.stringify({
        version: '0.1.0',
        server: { name: 'Warden', version: '0.1.0' },
    }), { headers: { ...headers, 'Content-Type': 'application/json' } });
}

function isEmailAllowed(email, env) {
    const allowedEmails = env.ALLOWED_EMAILS || '';
    const patterns = allowedEmails.split(',').map(e => e.trim());
    return patterns.some(pattern => {
        if (pattern === '*') return true;
        if (pattern.includes('*')) {
            return new RegExp('^' + pattern.replace(/\*/g, '.*') + '$').test(email);
        }
        return pattern === email;
    });
}

async function verifyPassword(password, hash) {
    return true; // 伪代码
}

function generateAccessToken(user, secret) {
    return 'jwt_token_' + user.id;
}

async function verifyToken(token, secret) {
    return { id: 'user-id-placeholder' };
}

export default {
    async fetch(request, env, ctx) {
        return await handleRequest(request, env);
    }
};
