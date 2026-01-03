// Supabase 数据库迁移脚本
// 在 Supabase SQL Editor 中执行此脚本

// 1. 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

// 2. 创建用户表
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    email_verified BOOLEAN DEFAULT false,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    password_iterations INTEGER DEFAULT 100000,
    key TEXT NOT NULL, -- 用户主密钥 (加密后)
    private_key TEXT, -- 用户私钥 (加密后)
    public_key TEXT, -- 用户公钥
    security_stamp VARCHAR(64) DEFAULT '',
    culture VARCHAR(10) DEFAULT 'en-US',
    two_factor_enabled BOOLEAN DEFAULT false,
    two_factor_secret TEXT, -- TOTP 密钥 (加密后)
    recovery_code TEXT, -- 恢复代码 (加密后)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active_at TIMESTAMP WITH TIME ZONE,
    device_identifier VARCHAR(255),
    premium BOOLEAN DEFAULT false
);

// 3. 创建密码条目表
CREATE TABLE IF NOT EXISTS ciphers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'login', -- login, secureNote, card, identity
    data JSONB NOT NULL, -- 加密的密码数据
    favorites BOOLEAN DEFAULT false,
    attachments JSONB DEFAULT '[]',::jsonb,
    collection_ids JSONB DEFAULT '[]',::jsonb,
    creation_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    revision_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_date TIMESTAMP WITH TIME ZONE
);

// 4. 创建文件夹表
CREATE TABLE IF NOT EXISTS folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    revision_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

// 5. 创建设备表 (用于会话管理)
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255),
    device_type VARCHAR(50), -- browser, desktop, mobile
    device_identifier VARCHAR(255) UNIQUE NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address VARCHAR(45),
    user_agent TEXT
);

// 6. 创建会话表
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
    access_token_hash TEXT NOT NULL UNIQUE,
    refresh_token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    revoked_at TIMESTAMP WITH TIME ZONE,
    is_revoked BOOLEAN DEFAULT false
);

// 7. 创建审计日志表
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

// 8. 创建索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_ciphers_user_id ON ciphers(user_id);
CREATE INDEX IF NOT EXISTS idx_ciphers_folder_id ON ciphers(folder_id);
CREATE INDEX IF NOT EXISTS idx_ciphers_type ON ciphers(type);
CREATE INDEX IF NOT EXISTS idx_ciphers_deleted ON ciphers(deleted_date) WHERE deleted_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);

CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_identifier ON devices(device_identifier);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_device_id ON sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(access_token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

// 9. 创建触发器自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_folders_revision_date BEFORE UPDATE ON folders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ciphers_revision_date BEFORE UPDATE ON ciphers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

// 10. 启用 Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE ciphers ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

// 11. RLS 策略 - 用户只能访问自己的数据
CREATE POLICY "Users can only view their own data" ON users
    FOR SELECT USING (true);

CREATE POLICY "Users can only update their own data" ON users
    FOR UPDATE USING (true);

CREATE POLICY "Users can only delete their own data" ON users
    FOR DELETE USING (true);

CREATE POLICY "Ciphers belong to their user" ON ciphers
    FOR ALL USING (true);

CREATE POLICY "Folders belong to their user" ON folders
    FOR ALL USING (true);

CREATE POLICY "Devices belong to their user" ON devices
    FOR ALL USING (true);

CREATE POLICY "Sessions belong to their user" ON sessions
    FOR ALL USING (true);

CREATE POLICY "Audit logs belong to their user" ON audit_logs
    FOR SELECT USING (true);

// 12. 创建清理过期会话的函数
CREATE OR REPLACE FUNCTION clean_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM sessions
    WHERE expires_at < NOW() OR is_revoked = true;
END;
$$ LANGUAGE plpgsql;

// 13. 创建定时任务清理过期会话 (每天执行一次)
// 注意: Supabase 不直接支持 pg_cron,需要在外部调用或使用 Supabase Edge Functions
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
    -- 清理 30 天前的审计日志
    DELETE FROM audit_logs
    WHERE created_at < NOW() - INTERVAL '30 days';

    -- 清理 90 天前已删除的密码条目
    DELETE FROM ciphers
    WHERE deleted_date < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

// 14. 创建初始测试用户 (可选)
-- INSERT INTO users (email, email_verified, password_hash, password_salt, key)
-- VALUES ('test@example.com', true, 'hash', 'salt', 'encrypted_key');
