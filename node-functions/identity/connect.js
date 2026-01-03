// Identity Connect Handler - 访问路径: /identity/connect
export async function onRequest(context) {
  const { env } = context;

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

  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
}
