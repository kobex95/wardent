// Supabase 客户端工具
export class SupabaseClient {
  private supabaseUrl: string;
  private serviceRoleKey: string;

  constructor(supabaseUrl: string, serviceRoleKey: string) {
    this.supabaseUrl = supabaseUrl;
    this.serviceRoleKey = serviceRoleKey;
  }

  private async request(method: string, table: string, data?: any, id?: string) {
    const url = `${this.supabaseUrl}/rest/v1/${table}${id ? '/' + id : ''}`;

    const headers = {
      'apikey': this.serviceRoleKey,
      'Authorization': `Bearer ${this.serviceRoleKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // 创建用户
  async createUser(user: {
    email: string;
    email_verified: boolean;
    password_hash: string;
    password_salt: string;
    key: string;
    private_key?: string;
    public_key?: string;
  }) {
    return this.request('POST', 'users', user);
  }

  // 根据邮箱查找用户
  async getUserByEmail(email: string) {
    const url = `${this.supabaseUrl}/rest/v1/users?email=eq.${email}`;
    const response = await fetch(url, {
      headers: {
        'apikey': this.serviceRoleKey,
        'Authorization': `Bearer ${this.serviceRoleKey}`,
      },
    });

    const data = await response.json();
    return data.length > 0 ? data[0] : null;
  }

  // 创建密码条目
  async createCipher(cipher: any) {
    return this.request('POST', 'ciphers', cipher);
  }

  // 获取用户的密码条目
  async getCiphers(userId: string) {
    const url = `${this.supabaseUrl}/rest/v1/ciphers?user_id=eq.${userId}&order=revision_date.desc`;
    const response = await fetch(url, {
      headers: {
        'apikey': this.serviceRoleKey,
        'Authorization': `Bearer ${this.serviceRoleKey}`,
      },
    });

    return response.json();
  }

  // 更新密码条目
  async updateCipher(cipherId: string, cipher: any) {
    return this.request('PATCH', 'ciphers', cipher, cipherId);
  }

  // 删除密码条目
  async deleteCipher(cipherId: string) {
    const url = `${this.supabaseUrl}/rest/v1/ciphers?id=eq.${cipherId}`;
    await fetch(url, {
      method: 'DELETE',
      headers: {
        'apikey': this.serviceRoleKey,
        'Authorization': `Bearer ${this.serviceRoleKey}`,
      },
    });
  }

  // 创建会话
  async createSession(session: any) {
    return this.request('POST', 'sessions', session);
  }

  // 验证会话
  async validateSession(sessionToken: string) {
    const url = `${this.supabaseUrl}/rest/v1/sessions?access_token=eq.${sessionToken}&is_revoked=eq.false&expires_at=gt.now()`;
    const response = await fetch(url, {
      headers: {
        'apikey': this.serviceRoleKey,
        'Authorization': `Bearer ${this.serviceRoleKey}`,
      },
    });

    const data = await response.json();
    return data.length > 0 ? data[0] : null;
  }

  // 撤销会话
  async revokeSession(sessionToken: string) {
    const url = `${this.supabaseUrl}/rest/v1/sessions?access_token=eq.${sessionToken}`;
    await fetch(url, {
      method: 'PATCH',
      headers: {
        'apikey': this.serviceRoleKey,
        'Authorization': `Bearer ${this.serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ is_revoked: true }),
    });
  }
}
