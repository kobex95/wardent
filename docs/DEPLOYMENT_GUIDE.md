# EdgeOne + Supabase 线上部署完整指南

## 目录
- [1. 系统架构概述](#1-系统架构概述)
- [2. Supabase 项目创建与配置](#2-supabase-项目创建与配置)
- [3. EdgeOne 项目创建与配置](#3-edgeone-项目创建与配置)
- [4. GitHub Actions 自动部署配置](#4-github-actions-自动部署配置)
- [5. 环境变量配置](#5-环境变量配置)
- [6. 数据库迁移执行](#6-数据库迁移执行)
- [7. 触发部署](#7-触发部署)
- [8. 生产环境检查清单](#8-生产环境检查清单)
- [9. 域名与 SSL 配置](#9-域名与-ssl-配置)
- [10. 性能与缓存优化](#10-性能与缓存优化)
- [11. 安全加固配置](#11-安全加固配置)
- [12. 监控与告警设置](#12-监控与告警设置)
- [13. 数据迁移方案](#13-数据迁移方案)
- [14. 故障排查指南](#14-故障排查指南)
- [15. 成本与扩展性分析](#15-成本与扩展性分析)

---

## 1. 系统架构概述

### 1.1 架构图
```
┌─────────────────────────────────────────────────────────────┐
│                     用户层 (客户端)                          │
│  Bitwarden Browser Extension / Mobile App / Web Client      │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                   EdgeOne Edge Network                      │
│  ┌────────────────────────────────────────────────────┐    │
│  │  EdgeOne Pages (静态资源托管 - 可选)               │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │  EdgeOne Edge Functions (API Serverless)          │    │
│  │  ┌──────────────────────────────────────────┐    │    │
│  │  │  Rust/WASM 模块 (核心业务逻辑)           │    │    │
│  │  │  - 身份认证 (JWT, PBKDF2)                │    │    │
│  │  │  - 密码加密/解密 (AES-256-GCM)           │    │    │
│  │  │  - TOTP 生成 (RFC 6238)                  │    │    │
│  │  │  - 数据验证与转换                         │    │    │
│  │  └──────────────────────────────────────────┘    │    │
│  │  ┌──────────────────────────────────────────┐    │    │
│  │  │  JavaScript 层 (HTTP 处理)              │    │    │
│  │  │  - 请求路由分发                          │    │    │
│  │  │  - CORS 处理                             │    │    │
│  │  │  - Supabase API 调用                    │    │    │
│  │  │  - 错误处理与日志                        │    │    │
│  │  └──────────────────────────────────────────┘    │    │
│  └────────────────────────────────────────────────────┘    │
│                        │ HTTPS / PostgreSQL Protocol        │
│                        ▼                                      │
│  ┌────────────────────────────────────────────────────┐    │
│  │  EdgeOne KV Cache (可选 - 缓存层)                   │    │
│  └────────────────────────────────────────────────────┘    │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTPS (REST API)
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                      Supabase Platform                      │
│  ┌────────────────────────────────────────────────────┐    │
│  │  PostgreSQL 数据库 (主数据存储)                    │    │
│  │  Tables: users, ciphers, folders, devices, etc.   │    │
│  │  Features: RLS, Indexes, Triggers                  │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Supabase Auth (可选 - 增强认证)                   │    │
│  │  - Email Verification                              │    │
│  │  - Session Management                             │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Supabase REST API (数据库接口层)                  │    │
│  │  - /rest/v1/*                                    │    │
│  │  - RLS 自动应用                                   │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 数据流向

#### 用户注册流程
```
Client → EdgeOne (prelogin) → Supabase (查询 KDF 参数)
      → EdgeOne (register) → Supabase (插入用户)
      → 返回成功响应
```

#### 用户登录流程
```
Client → EdgeOne (token) → Supabase (验证密码)
      → 生成 JWT → 存储会话 → 返回 Token
```

#### 数据同步流程
```
Client → EdgeOne (sync) [带 JWT]
      → 验证 Token → Supabase (查询用户数据)
      → 并行查询 ciphers, folders
      → 返回完整数据
```

### 1.3 安全机制

| 层级 | 安全措施 | 说明 |
|------|----------|------|
| 传输层 | HTTPS/TLS 1.3 | 所有通信加密 |
| 应用层 | JWT 认证 | 无状态令牌认证 |
| 数据层 | 客户端 AES-256 加密 | 密码库数据在客户端加密 |
| 数据库 | RLS (Row Level Security) | 用户只能访问自己的数据 |
| 访问控制 | 邮箱白名单 | 限制注册用户 |
| 审计 | 操作日志 | 记录所有敏感操作 |

---

## 2. Supabase 项目创建与配置

### 2.1 注册和登录 Supabase

1. 访问 https://supabase.com/signup
2. 选择注册方式:
   - **Email + Password**: 输入邮箱和密码
   - **GitHub 账号**: 使用 GitHub 快速登录
3. 验证邮箱地址 (检查收件箱，点击验证链接)
4. 验证成功后自动跳转到 Supabase Dashboard

### 2.2 创建新项目

#### 步骤 1: 选择或创建组织
```
Organization:
  [ ] Create new organization
      Name: MyCompany
      Pricing: Free

  [x] Use existing organization
      MyOrg (Free Plan)
```

#### 步骤 2: 配置项目信息
```
Project Details:
  Name: warden-worker
  Database Password: [点击生成或输入强密码]
    ⚠️ 请立即保存此密码，之后无法查看!

  Region: 选择离你最近的区域
    [ ] Northeast Asia (Tokyo) - 推荐
    [ ] Southeast Asia (Singapore)
    [ ] East US (N. Virginia)
    [ ] West US (Oregon)
    [ ] EU West (Ireland)
```

**区域选择建议**:
- 中国大陆用户: 选择东京或新加坡 (延迟较低)
- 美国用户: 选择 N. Virginia 或 Oregon
- 欧洲用户: 选择 Ireland

#### 步骤 3: 确认定价计划
```
Pricing Plan:
  [x] Free
      - 500MB Database
      - 1GB File Storage
      - 50K API requests/month
      - 2GB Bandwidth/month

  [ ] Pro ($25/month)
      - 8GB Database
      - 100GB File Storage
      - 500K API requests/month
      - 50GB Bandwidth/month
```

首次部署建议使用 **Free 计划**，后续可根据需求升级。

#### 步骤 4: 点击 "Create new project"

### 2.3 等待项目初始化

初始化过程大约需要 **2-5 分钟**，期间会:
- 创建 PostgreSQL 数据库实例
- 生成 API 密钥对 (anon key, service_role key)
- 配置网络连接和存储
- 初始化认证系统

等待期间你会看到进度提示:
```
Initializing database... (30%)
Setting up authentication... (60%)
Configuring storage... (90%)
Project is ready! (100%)
```

完成后会自动跳转到项目仪表板。

### 2.4 执行数据库迁移

#### 方式一: 使用 Supabase Dashboard SQL Editor (推荐)

1. 在左侧菜单点击 **SQL Editor**
2. 点击右上角 **New Query** 按钮
3. 打开项目文件 `supabase/migrations/001_init.sql`
4. 复制全部 SQL 代码 (Ctrl+A → Ctrl+C)
5. 粘贴到 SQL Editor 编辑框 (Ctrl+V)
6. 点击右上角 **Run** 按钮
7. 观察执行结果:

```
Success. No rows returned (耗时 1.2s)
```

如遇错误，检查:
- SQL 语法是否正确
- 是否有权限执行
- 是否已创建同名表

#### 方式二: 使用 Supabase CLI (高级)

```bash
# 1. 安装 Supabase CLI
npm install -g supabase

# 2. 登录 Supabase
supabase login

# 3. 链接项目
supabase link --project-ref YOUR_PROJECT_REF
# Project Ref 在 Dashboard 的 Settings > API 中可找到

# 4. 应用迁移
supabase db push
```

### 2.5 验证数据库结构

#### 2.5.1 检查表是否创建成功

1. 左侧菜单点击 **Table Editor**
2. 应该看到以下 6 张表:
   ```
   ✅ users (用户表)
   ✅ ciphers (密码条目表)
   ✅ folders (文件夹表)
   ✅ devices (设备表)
   ✅ sessions (会话表)
   ✅ audit_logs (审计日志表)
   ```

3. 点击 `users` 表查看结构，确认列存在:
   - id (UUID, PRIMARY KEY)
   - email (VARCHAR, UNIQUE, NOT NULL)
   - password_hash (TEXT, NOT NULL)
   - password_salt (TEXT, NOT NULL)
   - key (TEXT, NOT NULL)
   - public_key (TEXT)
   - private_key (TEXT)
   - security_stamp (VARCHAR)
   - two_factor_enabled (BOOLEAN)
   - two_factor_secret (TEXT)
   - created_at (TIMESTAMPTZ)
   - updated_at (TIMESTAMPTZ)
   - last_active_at (TIMESTAMPTZ)
   - device_identifier (VARCHAR)
   - premium (BOOLEAN)

#### 2.5.2 检查索引是否创建

在 SQL Editor 中执行以下查询:

```sql
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

应该看到以下索引 (共 16 个):

```
| tablename   | indexname                  |
|-------------|----------------------------|
| audit_logs  | idx_audit_logs_action      |
| audit_logs  | idx_audit_logs_created_at  |
| audit_logs  | idx_audit_logs_user_id     |
| ciphers     | idx_ciphers_deleted        |
| ciphers     | idx_ciphers_folder_id     |
| ciphers     | idx_ciphers_type          |
| ciphers     | idx_ciphers_user_id       |
| devices     | idx_devices_identifier     |
| devices     | idx_devices_user_id       |
| folders     | idx_folders_user_id       |
| sessions    | idx_sessions_device_id     |
| sessions    | idx_sessions_expires_at   |
| sessions    | idx_sessions_token_hash   |
| sessions    | idx_sessions_user_id      |
| users       | idx_users_email           |
| ciphers     | idx_ciphers_active (可选) |
| sessions    | idx_sessions_active (可选) |
```

#### 2.5.3 检查 RLS (Row Level Security) 是否启用

执行以下 SQL:

```sql
SELECT
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

所有表的 `rowsecurity` 列应该为 `t` (true)。

#### 2.5.4 检查 RLS 策略是否创建

```sql
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    cmd,
    qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

应该看到每个表都有对应的 RLS 策略。

### 2.6 获取 API 密钥

#### 2.6.1 导航到 API 设置

1. 左侧菜单点击 **Settings** (齿轮图标)
2. 点击 **API** 子菜单

#### 2.6.2 复制并保存密钥

在 "Project API keys" 部分找到以下密钥，**立即复制并保存**:

**1. Project URL**
```
https://your-project-id.supabase.co
```
说明: Supabase 项目的基础 URL，所有 API 请求都需要使用

**2. anon public key**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5eiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjUwMDAwMDAwLCJleHAiOjE5NjU1NTU1NTV9.example
```
说明: 客户端使用的公共密钥，受 RLS 限制

**3. service_role secret (⚠️ 高保密!)**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5eiIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE2NTAwMDAwMDAsImV4cCI6MTk2NTU1NTU1NX0.example
```
说明: 服务器端使用的管理员密钥，**可以绕过 RLS**

**⚠️ 重要提醒**:
- Service Role Key **绝对不能**暴露在前端代码
- Service Role Key **绝对不能**提交到 Git 仓库
- 建议使用密码管理器保存所有密钥
- 定期轮换密钥 (每 3-6 个月)

**4. Project Reference (用于 Supabase CLI)**
```
your-project-id
```
说明: 项目的唯一标识符

#### 2.6.3 测试 API 连接

使用 curl 测试连接是否正常:

```bash
# 设置环境变量 (替换为你的实际值)
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key-here"

# 测试 API
curl -X GET "${SUPABASE_URL}/rest/v1/users" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json"
```

预期返回:
```json
[]
```

如果返回错误，检查:
- URL 格式是否正确
- API Key 是否有效
- 网络连接是否正常

### 2.7 配置数据库连接池

EdgeOne Edge Functions 使用 Supabase REST API，无需直接连接数据库。

但如果需要直接连接数据库 (例如用于数据迁移)，可以配置以下参数:

在 SQL Editor 中执行:

```sql
-- 设置最大连接数
ALTER DATABASE postgres SET max_connections = 60;

-- 设置查询超时
ALTER ROLE postgres SET statement_timeout = '30s';

-- 设置空闲事务超时
ALTER ROLE postgres SET idle_in_transaction_session_timeout = '60s';

-- 设置锁超时
ALTER ROLE postgres SET lock_timeout = '10s';
```

### 2.8 配置自动备份

#### 2.8.1 检查备份状态

1. 左侧菜单 **Settings** → **Database**
2. 查找 **Backups** 部分
3. 应该看到:
   ```
   Physical Backups: Enabled
   Retention: 7 days (Free Plan)
   PITR (Point in Time Recovery): Disabled (Pro Plan only)
   ```

#### 2.8.2 手动触发备份

Free Plan 自动每天备份。如需手动备份，可使用 Supabase CLI:

```bash
# 导出数据库
pg_dump -h db.your-project-id.supabase.co -U postgres \
  -f backup-$(date +%Y%m%d).sql
```

### 2.9 配置查询性能监控

1. 左侧菜单 **Settings** → **Database**
2. 启用 **Query Performance Insights**
3. 设置日志保留时间: 7 天

这样可以在 Dashboard 中查看慢查询和性能瓶颈。

---

## 3. EdgeOne 项目创建与配置

### 3.1 创建 Supabase 项目

#### 3.1.1 注册和登录

1. 访问 https://supabase.com/signup
2. 选择注册方式:
   - Email + Password
   - GitHub 账号
3. 验证邮箱地址

#### 3.1.2 创建新项目

1. 登录后点击 "New Project"
2. 选择或创建 Organization:
   ```
   Organization Name: MyOrg
   Pricing Plan: Free (推荐先从免费开始)
   ```
3. 配置项目:
   ```
   Name: warden-worker
   Database Password: [生成强密码，记录下来]
   Region: 选择离你最近的区域
     - Northeast Asia (Tokyo)
     - Southeast Asia (Singapore)
     - China (Shenzhen) - 需要企业账号
   ```
4. 点击 "Create new project"

#### 3.1.3 等待项目初始化

初始化过程通常需要 2-5 分钟，期间会:
- 创建 PostgreSQL 数据库实例
- 生成 API 密钥
- 配置网络和存储

完成后会看到项目仪表板。

### 3.2 数据库架构配置

#### 3.2.1 执行迁移脚本

**方式 1: 使用 SQL Editor (推荐)**

1. 进入项目 -> 左侧菜单 "SQL Editor"
2. 点击 "New Query"
3. 复制 `supabase/migrations/001_init.sql` 全部内容
4. 粘贴到编辑器
5. 点击 "Run" 执行
6. 等待执行完成，检查输出:
   ```
   Success. No rows returned (耗时 X ms)
   ```

**方式 2: 使用 Supabase CLI (高级)**

```bash
# 安装 Supabase CLI
npm install -g supabase

# 登录
supabase login

# 链接项目
supabase link --project-ref YOUR_PROJECT_REF

# 应用迁移
supabase db push
```

#### 3.2.2 验证表结构

1. 进入项目 -> "Table Editor"
2. 应该看到以下表:
   ```
   - users (用户表)
   - ciphers (密码条目表)
   - folders (文件夹表)
   - devices (设备表)
   - sessions (会话表)
   - audit_logs (审计日志表)
   ```

3. 点击每个表查看结构，确认所有列存在

#### 3.2.3 验证索引

在 SQL Editor 中执行:
```sql
-- 查看所有索引
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 应该看到以下索引:
-- idx_ciphers_user_id
-- idx_ciphers_folder_id
-- idx_ciphers_type
-- idx_ciphers_deleted
-- idx_folders_user_id
-- idx_devices_user_id
-- idx_devices_identifier
-- idx_sessions_user_id
-- idx_sessions_device_id
-- idx_sessions_token_hash
-- idx_sessions_expires_at
-- idx_audit_logs_user_id
-- idx_audit_logs_created_at
-- idx_audit_logs_action
-- idx_users_email
```

#### 3.2.4 验证 RLS 策略

```sql
-- 检查 RLS 状态
SELECT
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 应该所有表的 rowsecurity = t

-- 查看具体策略
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE schemaname = 'public';
```

### 3.3 获取 API 密钥

#### 3.3.1 导航到 API 设置

1. 进入项目 -> 左侧菜单 "Settings" -> "API"
2. 复制以下信息到安全的位置:

#### 3.3.2 API 密钥说明

```
┌─────────────────────────────────────────────────────────────┐
│ Project URL                                                  │
│ https://your-project-id.supabase.co                          │
│ 说明: Supabase 项目的基础 URL，用于所有 API 请求             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ anon public key                                              │
│ eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...                      │
│ 说明: 客户端使用的公共密钥，受 RLS 限制                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ service_role secret (⚠️ 保密!)                               │
│ eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...                      │
│ 说明: 服务器端使用的管理员密钥，可绕过 RLS                    │
│ ⚠️ 绝不要暴露在前端代码或 Git 仓库中!                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Project Reference (用于 Supabase CLI)                       │
│ your-project-id                                               │
│ 说明: 项目的唯一标识符                                       │
└─────────────────────────────────────────────────────────────┘
```

#### 3.3.3 测试 API 连接

使用 curl 测试连接:

```bash
# 替换为你的实际 URL 和 anon key
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key"

# 测试 API
curl -X GET "${SUPABASE_URL}/rest/v1/users" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json"

# 应该返回空数组: []
```

### 3.4 数据库连接配置

#### 3.4.1 获取连接字符串

1. 进入项目 -> Settings -> Database
2. 查找 "Connection string" 部分
3. 选择 "URI" 格式:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```
4. 注意:
   - `[YOUR-PASSWORD]` 是创建项目时设置的密码
   - 保存此连接字符串用于本地开发

#### 3.4.2 配置连接池

EdgeOne Edge Functions 无需直接连接数据库，而是通过 Supabase REST API。但如果需要，可以配置连接池参数:

```sql
-- 在 SQL Editor 中执行 (需要 service_role 权限)
ALTER DATABASE postgres SET max_connections = 60;
ALTER ROLE postgres SET statement_timeout = '30s';
ALTER ROLE postgres SET idle_in_transaction_session_timeout = '60s';
```

### 3.5 数据库性能优化

#### 3.5.1 启用自动清理

```sql
-- 确保自动清理已启用
ALTER TABLE ciphers SET (autovacuum_analyze_scale_factor = 0.05);
ALTER TABLE ciphers SET (autovacuum_vacuum_scale_factor = 0.1);
ALTER TABLE sessions SET (autovacuum_vacuum_scale_factor = 0.1);
```

#### 3.5.2 配置查询超时

```sql
-- 设置会话超时
ALTER ROLE postgres SET statement_timeout = '30s';
ALTER ROLE postgres SET idle_in_transaction_session_timeout = '60s';

-- 设置锁超时
ALTER ROLE postgres SET lock_timeout = '10s';
```

#### 3.5.3 创建部分索引 (可选优化)

```sql
-- 只为未删除的条目创建索引
CREATE INDEX idx_ciphers_active 
ON ciphers(user_id, revision_date DESC) 
WHERE deleted_date IS NULL;

-- 为活跃会话创建索引
CREATE INDEX idx_sessions_active
ON sessions(user_id, expires_at DESC)
WHERE is_revoked = false;
```

### 3.6 备份和恢复配置

#### 3.6.1 启用自动备份

1. 进入项目 -> Settings -> Database
2. 查找 "Backups" 部分
3. 确认状态:
   ```
   Physical Backups: Enabled (每天自动备份)
   Point in Time Recovery: Optional (付费功能)
   ```
4. 免费层保留 7 天备份

#### 3.6.2 手动备份

```sql
-- 导出数据库结构
pg_dump -h db.[PROJECT-REF].supabase.co -U postgres \
  --schema-only \
  -f schema.sql

-- 导出数据
pg_dump -h db.[PROJECT-REF].supabase.co -U postgres \
  --data-only \
  -f data.sql
```

### 3.7 监控和日志

#### 3.7.1 启用查询日志

1. 进入项目 -> Settings -> Database
2. 启用 "Query Performance Insights"
3. 设置日志保留时间

#### 3.7.2 查看慢查询

```sql
-- 查看查询统计
SELECT
    query,
    calls,
    total_time,
    mean_time,
    max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

### 3.1 注册腾讯云并开通 EdgeOne

#### 步骤 1: 注册腾讯云账号
1. 访问 https://console.cloud.tencent.com
2. 点击右上角 **注册**
3. 填写注册信息:
   - 手机号
   - 验证码
   - 密码
4. 同意服务协议并提交

#### 步骤 2: 完成实名认证

**个人认证**:
1. 登录控制台后，点击右上角 **账号中心**
2. 选择 **实名认证** → **个人认证**
3. 上传身份证正反面照片
4. 进行人脸识别验证
5. 等待审核 (通常 1-2 小时)

**企业认证** (如需要):
1. 选择 **企业认证**
2. 上传营业执照
3. 填写企业信息
4. 等待审核 (通常 1-3 个工作日)

⚠️ **重要**: 实名认证完成后才能开通 EdgeOne 服务。

#### 步骤 3: 开通 EdgeOne 服务
1. 在控制台搜索栏输入 **"EdgeOne"**
2. 点击 **立即开通**
3. 选择服务方案:
   ```
   [x] 免费版
       - 10万请求/月
       - 10GB 流量/月
       - 基础防护
       - 全球加速
   
   [ ] 基础版 (¥99/月)
       - 100万请求/月
       - 100GB 流量/月
       - 高级防护
       - 全功能支持
   ```
4. 阅读并同意服务条款
5. 点击 **立即开通**

### 3.2 创建 EdgeOne Pages 项目

#### 步骤 1: 导航到 Pages
1. 登录 EdgeOne 控制台
2. 左侧菜单找到并点击 **Pages**
3. 点击 **创建项目** 按钮

#### 步骤 2: 选择创建方式
```
选择创建方式:

[ ] 直接上传
    上传本地构建好的项目文件夹

[ ] 从模板开始
    使用预设模板快速创建项目

[x] 导入 Git 仓库
    从 GitHub/GitLab 导入代码仓库
```

选择 **导入 Git 仓库**

#### 步骤 3: 绑定 GitHub 账号
1. 点击 **绑定 GitHub**
2. 系统会跳转到 GitHub 授权页面
3. 点击 **Authorize TencentCloud**
4. 授权 EdgeOne 访问你的 GitHub 仓库:
   - Repository contents (读取仓库内容)
   - Repository metadata (读取仓库元数据)
   - Webhooks (创建 Webhook)

#### 步骤 4: 选择仓库
授权成功后，会列出你的 GitHub 仓库:
```
选择要部署的仓库:

Repository: [your-username/warden-worker ▾]
           - your-username/warden-worker
           - your-username/other-repo

Branch:    [main ▾]
           - main
           - master
           - develop

Framework: [Auto-detect ▾]
           - Auto-detect (推荐)
           - Next.js
           - Nuxt.js
           - Static Site
           - Custom
```

配置如下:
- **Repository**: 选择你的 warden-worker 仓库
- **Branch**: main (或你的主分支)
- **Framework**: Auto-detect (让 EdgeOne 自动识别)

#### 步骤 5: 配置构建设置
点击 **高级设置**，展开构建配置:

```
Build Settings:

构建命令: [npm run build]
输出目录: [build]
Node.js 版本: [18 ▾]
环境变量:  (在下一节详细配置)
```

点击 **创建项目**。

#### 步骤 6: 等待首次部署

项目创建后会自动触发首次部署，你可以看到:
```
部署日志:

[info] Cloning repository...
[info] Installing dependencies...
[info] Building Rust/WASM module...
[info] Building Edge Functions...
[info] Uploading to EdgeOne...
[success] Deployment completed successfully!
```

首次部署可能需要 5-10 分钟，因为需要:
- 克隆仓库
- 安装 Node.js 依赖
- 编译 Rust/WASM 模块
- 构建静态资源
- 上传到 EdgeOne CDN

### 3.3 配置环境变量

#### 步骤 1: 进入环境变量配置
1. 在项目页面，点击左侧 **设置**
2. 点击 **环境变量**
3. 点击 **添加变量**

#### 步骤 2: 添加 Supabase 配置

**变量 1: SUPABASE_URL**
```
名称: SUPABASE_URL
值: https://your-project-id.supabase.co
类型: 文本
描述: Supabase 项目地址
```

**变量 2: SUPABASE_ANON_KEY**
```
名称: SUPABASE_ANON_KEY
值: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
类型: 文本
描述: Supabase 客户端密钥
```

**变量 3: SUPABASE_SERVICE_ROLE_KEY** (⚠️ 高保密)
```
名称: SUPABASE_SERVICE_ROLE_KEY
值: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
类型: 密文 (选择密文类型，部分内容会隐藏)
描述: Supabase 服务端密钥 (绕过 RLS)
```

#### 步骤 3: 添加 JWT 配置

**生成 JWT 密钥** (使用在线工具或本地命令):

```bash
# 使用 OpenSSL
openssl rand -base64 64
# 输出类似: Xy9+abC/123... (64 字符)
```

**变量 4: JWT_SECRET**
```
名称: JWT_SECRET
值: [生成的64字符随机字符串]
类型: 密文
描述: JWT 访问令牌签名密钥
```

**变量 5: JWT_REFRESH_SECRET** (生成另一个不同的密钥)
```
名称: JWT_REFRESH_SECRET
值: [生成的另一个64字符随机字符串]
类型: 密文
描述: JWT 刷新令牌签名密钥
```

#### 步骤 4: 添加访问控制配置

**变量 6: ALLOWED_EMAILS**
```
名称: ALLOWED_EMAILS
值: your-email@example.com,*@your-company.com
类型: 文本
描述: 允许注册的邮箱列表 (逗号分隔)
```

支持格式:
- 单个邮箱: `user@example.com`
- 多个邮箱: `user1@ex.com,user2@ex.com`
- 域名通配符: `*@company.com`
- 混合配置: `admin@ex.com,*@company.com`
- 允许所有: `*` (⚠️ 不推荐生产环境)

**变量 7: CORS_ALLOWED_ORIGINS**
```
名称: CORS_ALLOWED_ORIGINS
值: https://warden.yourdomain.com,https://www.yourdomain.com
类型: 文本
描述: 允许的 CORS 来源 (逗号分隔)
```

#### 步骤 5: 添加应用配置

**变量 8: APP_ENV**
```
名称: APP_ENV
值: production
类型: 文本
描述: 运行环境
```

**变量 9: LOG_LEVEL**
```
名称: LOG_LEVEL
值: info
类型: 文本
描述: 日志级别
```

可选值: `error`, `warn`, `info`, `debug`, `trace`

#### 步骤 6: 添加数据库配置

**变量 10: DB_POOL_SIZE**
```
名称: DB_POOL_SIZE
值: 5
类型: 数字
描述: 数据库连接池大小
```

**变量 11: DB_CONNECTION_TIMEOUT**
```
名称: DB_CONNECTION_TIMEOUT
值: 10s
类型: 文本
描述: 数据库连接超时时间
```

#### 步骤 7: 添加加密配置

**变量 12: PBKDF2_ITERATIONS**
```
名称: PBKDF2_ITERATIONS
值: 100000
类型: 数字
描述: PBKDF2 迭代次数 (推荐 >= 100000)
```

**变量 13: ENCRYPTION_KEY_SIZE**
```
名称: ENCRYPTION_KEY_SIZE
值: 256
类型: 数字
描述: 加密密钥长度 (位)
```

#### 步骤 8: 添加缓存配置

**变量 14: ENABLE_CACHE**
```
名称: ENABLE_CACHE
值: true
类型: 布尔
描述: 是否启用缓存
```

**变量 15: CACHE_TTL**
```
名称: CACHE_TTL
值: 300
类型: 数字
描述: 缓存过期时间 (秒)
```

#### 步骤 9: 添加安全配置

**变量 16: RATE_LIMIT_PER_MINUTE**
```
名称: RATE_LIMIT_PER_MINUTE
值: 60
类型: 数字
描述: 每分钟请求速率限制
```

**变量 17: SESSION_EXPIRE_HOURS**
```
名称: SESSION_EXPIRE_HOURS
值: 24
类型: 数字
描述: 会话过期时间 (小时)
```

#### 步骤 10: 保存并触发重新部署

添加完所有变量后:
1. 点击 **保存**
2. 系统提示是否触发重新部署
3. 点击 **立即部署** 以应用新环境变量

### 3.4 配置路由规则

#### 步骤 1: 进入路由配置
1. 项目页面 → 左侧 **路由配置**
2. 点击 **添加路由**

#### 步骤 2: 配置 API 路由

**路由 1: Identity 相关**
```
路由模式: /identity/*
处理函数: identity-handler
描述: 处理所有身份认证相关请求
```

**路由 2: API 相关**
```
路由模式: /api/*
处理函数: api-handler
描述: 处理所有 API 请求
```

点击 **保存**。

#### 步骤 3: 验证路由配置

路由配置完成后，你应该看到:
```
当前路由列表:

路由模式              | 处理函数       | 优先级 | 状态
--------------------|---------------|--------|------
/identity/*          | identity-handler | 1     | ✅ 启用
/api/*              | api-handler     | 2     | ✅ 启用
```

### 3.5 获取部署 URL 和 API Token

#### 步骤 1: 查看部署 URL
1. 项目页面 → **概览**
2. 在 **访问地址** 部分可以看到:
   ```
   部署 URL: https://your-project.pages.edgeone.com
   状态: ✅ 运行中
   ```
3. 点击 URL 可以访问部署的应用

#### 步骤 2: 创建 API Token (用于 GitHub Actions)
1. 项目页面 → **设置** → **访问密钥**
2. 点击 **创建密钥**
3. 填写密钥信息:
   ```
   密钥名称: GitHub Actions Deploy
   权限:
     [✓] Deploy - 部署新版本
     [✓] Read - 读取项目信息
     [ ] Delete - 删除部署 (可选)
   
   过期时间: 1 年
   ```
4. 点击 **创建**
5. **立即复制生成的 Token** (只显示一次!)

格式类似:
```
e1at_your_api_token_here_xxxxxxx
```

#### 步骤 3: 记录项目信息

将以下信息保存到安全的位置:
```
EdgeOne 项目信息:
- 部署 URL: https://your-project.pages.edgeone.com
- 项目 ID: 从 URL 中提取
- API Token: e1at_xxxxxx
- 项目名称: warden-worker
```

---

## 4. GitHub Actions 自动部署配置

### 4.1 注册和登录 EdgeOne

#### 4.1.1 创建腾讯云账号
1. 访问 https://console.cloud.tencent.com
2. 点击 "注册"
3. 完成实名认证:
   - 个人认证: 身份证
   - 企业认证: 营业执照
4. 完成后进入控制台

#### 4.1.2 开通 EdgeOne 服务
1. 在控制台搜索 "EdgeOne"
2. 点击 "立即开通"
3. 选择服务方案:
   ```
   免费版 (推荐开始):
   - 10万请求/月
   - 10GB 流量/月
   - 基础功能
   ```

### 4.2 创建 EdgeOne Pages 项目

#### 4.2.1 创建项目
1. 进入 EdgeOne 控制台
2. 左侧菜单选择 "Pages"
3. 点击 "创建项目"
4. 选择创建方式:
   ```
   [√] 导入 Git 仓库
   ```

#### 4.2.2 关联 GitHub 仓库
1. 点击 "绑定 GitHub"
2. 授权 EdgeOne 访问你的 GitHub 账号
3. 选择要部署的仓库:
   ```
   仓库: your-username/warden-worker
   分支: main (或 master)
   ```
4. 点击 "创建项目"

#### 4.2.3 配置构建设置
项目创建后会自动检测配置。手动配置:

1. 进入项目 -> "构建配置"
2. 设置以下参数:
   ```
   构建命令: npm run build
   输出目录: build
   Node.js 版本: 18
   环境变量: (见下一节)
   ```

### 4.3 配置环境变量

#### 4.3.1 在 EdgeOne 控制台添加

1. 进入项目 -> "环境变量"
2. 点击 "添加变量"
3. 依次添加以下变量:

```bash
# ========== Supabase 配置 ==========
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ========== JWT 配置 ==========
JWT_SECRET=生成的64字符随机字符串
JWT_REFRESH_SECRET=生成的另一个64字符随机字符串

# ========== 访问控制 ==========
ALLOWED_EMAILS=user@example.com,admin@domain.com,*@company.com
CORS_ALLOWED_ORIGINS=https://warden.yourdomain.com,https://www.yourdomain.com

# ========== 应用配置 ==========
APP_ENV=production
LOG_LEVEL=info

# ========== 数据库配置 ==========
DB_POOL_SIZE=5
DB_CONNECTION_TIMEOUT=10s

# ========== 加密配置 ==========
PBKDF2_ITERATIONS=100000
ENCRYPTION_KEY_SIZE=256

# ========== 缓存配置 ==========
ENABLE_CACHE=true
CACHE_TTL=300

# ========== 安全配置 ==========
RATE_LIMIT_PER_MINUTE=60
SESSION_EXPIRE_HOURS=24
```

#### 4.3.2 环境变量详细说明

| 变量名 | 类型 | 必填 | 说明 | 示例值 |
|--------|------|------|------|--------|
| `SUPABASE_URL` | URL | 是 | Supabase 项目地址 | `https://xyz.supabase.co` |
| `SUPABASE_ANON_KEY` | String | 是 | 客户端 API 密钥 | `eyJh...` |
| `SUPABASE_SERVICE_ROLE_KEY` | String | 是 | 服务端 API 密钥 | `eyJh...` |
| `JWT_SECRET` | String | 是 | JWT 访问令牌签名密钥 | 64 字符随机字符串 |
| `JWT_REFRESH_SECRET` | String | 是 | JWT 刷新令牌签名密钥 | 64 字符随机字符串 |
| `ALLOWED_EMAILS` | String | 是 | 允许注册的邮箱列表 (逗号分隔) | `user@ex.com` |
| `CORS_ALLOWED_ORIGINS` | String | 是 | 允许的 CORS 来源 | `https://app.com` |
| `APP_ENV` | String | 否 | 运行环境 | `production` |
| `LOG_LEVEL` | String | 否 | 日志级别 | `info` |
| `DB_POOL_SIZE` | Number | 否 | 数据库连接池大小 | `5` |
| `PBKDF2_ITERATIONS` | Number | 否 | PBKDF2 迭代次数 | `100000` |

#### 4.3.3 邮箱白名单配置

`ALLOWED_EMAILS` 支持以下格式:

```bash
# 单个邮箱
ALLOWED_EMAILS=user@example.com

# 多个邮箱
ALLOWED_EMAILS=user1@example.com,user2@example.com

# 域名通配符
ALLOWED_EMAILS=*@company.com

# 混合配置
ALLOWED_EMAILS=admin@company.com,*@company.com,*@partner.com

# 允许所有 (不推荐生产环境)
ALLOWED_EMAILS=*
```

### 4.4 配置 Edge Functions 路由

#### 4.4.1 创建路由规则

1. 进入项目 -> "路由配置"
2. 点击 "添加路由"
3. 添加以下路由:

| 模式 | 处理函数 | 说明 |
|------|----------|------|
| `/identity/*` | identity-handler | 身份相关接口 |
| `/api/*` | api-handler | API 接口 |

#### 4.4.2 函数目录结构

EdgeOne 会自动根据 `functions/` 目录结构生成路由:

```
functions/
├── identity/
│   └── [[path]].js          # 处理 /identity/*
└── api/
    ├── sync.js              # 处理 /api/sync
    ├── ciphers/
    │   ├── create.js        # 处理 /api/ciphers/create
    │   └── [id].js          # 处理 /api/ciphers/:id
    └── folders/
        └── [id].js          # 处理 /api/folders/:id
```

### 4.5 获取 API Token

#### 4.5.1 创建 API Token

1. 进入项目 -> "设置"
2. 查找 "API Token" 或 "访问密钥"
3. 点击 "创建新 Token"
4. 设置 Token 信息:
   ```
   名称: GitHub Actions Deploy
   权限: Deploy
   过期时间: 1 年
   ```
5. 复制生成的 Token (只显示一次!)

#### 4.5.2 Token 权限说明

| 权限 | 用途 |
|------|------|
| Read | 读取项目信息 |
| Deploy | 部署新版本 |
| Delete | 删除部署 |

GitHub Actions 需要至少 Deploy 权限。

### 4.6 配置域名和 SSL

#### 4.6.1 添加自定义域名

1. 进入项目 -> "域名"
2. 点击 "添加域名"
3. 输入域名: `warden.yourdomain.com`
4. 系统会提供 DNS 配置:
   ```
   记录类型: CNAME
   主机记录: warden
   记录值: your-project.pages.edgeone.com
   TTL: 600
   ```

#### 4.6.2 配置 DNS

在你的域名 DNS 提供商 (腾讯云、阿里云等) 添加记录:

```
名称: warden
类型: CNAME
值: your-project.pages.edgeone.com
TTL: 600
```

#### 4.6.3 等待 SSL 证书

EdgeOne 会自动为你的域名签发 Let's Encrypt SSL 证书，通常 5-10 分钟完成。

验证: 访问 `https://warden.yourdomain.com` 应该看到 HTTPS 锁定图标。

### 4.7 CDN 缓存配置

#### 4.7.1 配置缓存规则

1. 进入项目 -> "缓存配置"
2. 添加缓存规则:

| 路径模式 | 缓存时间 | 说明 |
|----------|----------|------|
| `/api/config` | 5 分钟 | 配置接口可缓存 |
| `/identity/accounts/prelogin` | 5 分钟 | Prelogin 结果可缓存 |
| `/api/sync` | 1 分钟 | 同步数据短暂缓存 |
| `/api/*` | 不缓存 | 其他 API 不缓存 |
| `/static/*` | 1 小时 | 静态资源长时间缓存 |

#### 4.7.2 缓存键配置

```json
{
  "ignoreQueryParams": ["timestamp", "_"],
  "varyHeaders": ["Authorization"],
  "respectOrigin": true
}
```

### 4.8 安全配置

#### 4.8.1 启用 WAF (Web 应用防火墙)

1. 进入项目 -> "安全"
2. 启用 "WAF"
3. 配置规则:
   ```
   - SQL 注入防护: 启用
   - XSS 防护: 启用
   - 路径遍历防护: 启用
   ```

#### 4.8.2 速率限制

配置速率限制规则:

| 规则 | 阈值 | 动作 |
|------|------|------|
| 全局限速 | 60 次/分钟 | 拒绝 |
| 登录接口 | 10 次/分钟 | 拒绝 |
| 注册接口 | 5 次/小时 | 拒绝 |

#### 4.8.3 IP 黑名单

在 "安全 -> IP 访问控制" 中添加:
- 已知恶意 IP
- 扫描器 IP
- DDoS 攻击来源

### 4.9 监控和日志配置

#### 4.9.1 访问日志

1. 进入项目 -> "日志"
2. 启用 "访问日志"
3. 设置日志保留:
   ```
   保留时长: 7 天
   格式: JSON
   ```

#### 4.9.2 实时监控

1. 进入项目 -> "监控"
2. 关注以下指标:
   - QPS (每秒请求数)
   - 错误率
   - 响应时间 (P50, P95, P99)
   - 流量使用

#### 4.9.3 告警配置

设置告警规则:

| 指标 | 阈值 | 通知方式 |
|------|------|----------|
| 错误率 | > 5% | 邮件 |
| 响应时间 | > 1s | 邮件 |
| 流量使用 | > 80% 配额 | 邮件 |

### 4.1 配置 GitHub Secrets

#### 步骤 1: 导航到 GitHub 仓库 Secrets
1. 打开你的 GitHub 仓库: `https://github.com/your-username/warden-worker`
2. 点击 **Settings** 标签
3. 左侧菜单找到 **Secrets and variables** → **Actions**
4. 点击 **New repository secret**

#### 步骤 2: 添加 EdgeOne 相关 Secrets

**Secret 1: EDGEONE_API_TOKEN**
```
Name: EDGEONE_API_TOKEN
Value: e1at_your_api_token_here (从 EdgeOne 复制)
Description: EdgeOne API Token for deployment
```

**Secret 2: EDGEONE_PROJECT_ID**
```
Name: EDGEONE_PROJECT_ID
Value: your-project-id (从部署 URL 中提取)
Description: EdgeOne Pages Project ID
```

如何获取 Project ID:
- 部署 URL: `https://warden-abc123.pages.edgeone.com`
- Project ID: `warden-abc123`

**Secret 3: EDGEONE_DEPLOY_URL** (可选)
```
Name: EDGEONE_DEPLOY_URL
Value: https://warden-abc123.pages.edgeone.com
Description: EdgeOne deployment URL for health check
```

#### 步骤 3: 添加 Supabase 相关 Secrets

**Secret 4: SUPABASE_URL**
```
Name: SUPABASE_URL
Value: https://your-project-id.supabase.co
Description: Supabase Project URL
```

**Secret 5: SUPABASE_ANON_KEY**
```
Name: SUPABASE_ANON_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Description: Supabase Anon Public Key
```

**Secret 6: SUPABASE_SERVICE_ROLE_KEY**
```
Name: SUPABASE_SERVICE_ROLE_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Description: Supabase Service Role Key (High Security!)
```

⚠️ **注意**: Service Role Key 具有完全访问权限，请确保该 Secret 只有管理员可访问。

#### 步骤 4: 添加 JWT 相关 Secrets

**Secret 7: JWT_SECRET**
```
Name: JWT_SECRET
Value: your-64-char-random-string-here
Description: JWT Access Token Secret
```

**Secret 8: JWT_REFRESH_SECRET**
```
Name: JWT_REFRESH_SECRET
Value: another-64-char-random-string-here
Description: JWT Refresh Token Secret
```

⚠️ **重要**: 确保 JWT_SECRET 和 JWT_REFRESH_SECRET 不同。

#### 步骤 5: 添加应用配置 Secrets

**Secret 9: ALLOWED_EMAILS**
```
Name: ALLOWED_EMAILS
Value: user@example.com,*@company.com
Description: Allowed email addresses for registration
```

**Secret 10: CORS_ALLOWED_ORIGINS**
```
Name: CORS_ALLOWED_ORIGINS
Value: https://warden.yourdomain.com
Description: CORS allowed origins
```

#### 步骤 6: 验证 Secrets 配置

添加完成后，在 Secrets 页面应该看到:
```
Repository secrets (10):

Name                          | Updated at | Description
------------------------------|-----------|----------------------
EDGEONE_API_TOKEN            | 2 min ago  | EdgeOne API Token
EDGEONE_PROJECT_ID           | 2 min ago  | EdgeOne Pages Project ID
EDGEONE_DEPLOY_URL           | 2 min ago  | EdgeOne deployment URL
SUPABASE_URL                 | 1 min ago  | Supabase Project URL
SUPABASE_ANON_KEY            | 1 min ago  | Supabase Anon Key
SUPABASE_SERVICE_ROLE_KEY    | 1 min ago  | Supabase Service Role Key
JWT_SECRET                   | 1 min ago  | JWT Access Token Secret
JWT_REFRESH_SECRET           | 1 min ago  | JWT Refresh Token Secret
ALLOWED_EMAILS               | 1 min ago  | Allowed email addresses
CORS_ALLOWED_ORIGINS         | 1 min ago  | CORS allowed origins
```

### 4.2 检查 GitHub Actions Workflow 文件

#### 步骤 1: 确认 Workflow 文件存在

检查 `.github/workflows/edgeone-deploy.yml` 文件是否存在:
```
.github/
└── workflows/
    └── edgeone-deploy.yml
```

#### 步骤 2: 验证 Workflow 配置

打开文件，确保包含以下关键步骤:

```yaml
name: Deploy to EdgeOne

on:
  push:
    branches:
      - main
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Setup Rust
        uses: actions-rs/toolchain@v1
        with:
          profile: minimal
          toolchain: stable
          target: wasm32-wasi
      
      - name: Build
        run: |
          npm ci
          cargo build --target wasm32-wasi --release
      
      - name: Deploy to EdgeOne
        run: |
          edgeone pages deploy \
            --token ${{ secrets.EDGEONE_API_TOKEN }} \
            --project ${{ secrets.EDGEONE_PROJECT_ID }}
```

### 4.3 配置分支保护 (可选但推荐)

#### 步骤 1: 进入分支保护设置
1. 仓库 → **Settings** → **Branches**
2. 在 **Branch protection rules** 部分点击 **Add rule**

#### 步骤 2: 配置 main 分支保护
```
Branch name pattern: main

Settings:

[✓] Require a pull request before merging
    Require approvals: 1
    Dismiss stale PR approvals when new commits are pushed: ✓

[✓] Require status checks to pass before merging
    Required status checks:
      [✓] Build (or your CI job name)

[✓] Do not allow bypassing the above settings
```

点击 **Create** 保存。

### 4.4 验证 Workflow 配置

#### 步骤 1: 手动触发部署

1. 仓库 → **Actions** 标签
2. 左侧找到 **Deploy to EdgeOne** workflow
3. 点击 **Run workflow**
4. 选择分支: `main`
5. 点击 **Run workflow**

#### 步骤 2: 观察部署过程

部署过程应该包括:
```
✓ Checkout code
✓ Setup Node.js
✓ Setup Rust toolchain
✓ Install dependencies
✓ Build Rust/WASM module
✓ Build Edge Functions
✓ Deploy to EdgeOne
✓ Health check
```

#### 步骤 3: 检查部署结果

部署完成后:
- 查看日志确认所有步骤成功
- 访问部署 URL 验证应用正常运行
- 检查 EdgeOne 控制台确认部署记录

---

## 6. 数据库迁移执行

### 6.1 使用 Supabase SQL Editor 执行迁移 (推荐)

#### 步骤 1: 打开 SQL Editor

1. 登录 Supabase Dashboard
2. 左侧菜单点击 **SQL Editor**
3. 点击右上角 **New Query** 按钮

#### 步骤 2: 准备迁移脚本

打开项目中的 `supabase/migrations/001_init.sql` 文件。

#### 步骤 3: 执行迁移

1. 全选 SQL 文件内容 (Ctrl+A)
2. 复制 (Ctrl+C)
3. 回到 Supabase SQL Editor
4. 粘贴内容 (Ctrl+V)
5. 点击右上角 **Run** 按钮

#### 步骤 4: 验证执行结果

观察执行输出，应该看到:
```
Success. No rows returned (耗时 1.2s)
```

如果有错误，检查:
- SQL 语法是否正确
- 是否有重复的表或索引
- Supabase 账号是否有足够权限

### 6.2 使用 Supabase CLI 执行迁移 (高级)

#### 步骤 1: 安装 Supabase CLI

```bash
npm install -g supabase
```

#### 步骤 2: 登录 Supabase

```bash
supabase login
```

系统会打开浏览器，授权 Supabase CLI 访问。

#### 步骤 3: 链接项目

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

Project Ref 可以在:
- Supabase Dashboard → Settings → API
- URL: `https://[PROJECT_REF].supabase.co`

#### 步骤 4: 应用迁移

```bash
supabase db push
```

CLI 会自动检测并应用所有未执行的迁移文件。

### 6.3 验证迁移结果

#### 检查表是否创建

在 Supabase Dashboard → Table Editor 中，应该看到以下表:
- ✅ users
- ✅ ciphers
- ✅ folders
- ✅ devices
- ✅ sessions
- ✅ audit_logs

#### 检查索引是否创建

在 SQL Editor 执行:

```sql
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

应该看到所有 14+ 个索引。

#### 检查 RLS 是否启用

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

所有表的 `rowsecurity` 应该为 `t`。

---

## 7. 触发部署

### 7.1 自动部署 (推荐)

#### 方式 1: 通过 Git 推送触发

当向配置的分支推送代码时，GitHub Actions 会自动触发部署:

```bash
git add .
git commit -m "Update deployment"
git push origin main
```

推送后:
1. GitHub 自动检测到推送
2. 触发 `Deploy to EdgeOne` workflow
3. 开始构建和部署
4. 部署完成后自动更新 EdgeOne Pages

#### 方式 2: 通过 Pull Request 触发

如果配置了分支保护，需要通过 PR 部署:

1. 创建新分支:
   ```bash
   git checkout -b feature/new-feature
   ```

2. 修改代码并推送:
   ```bash
   git add .
   git commit -m "Add new feature"
   git push origin feature/new-feature
   ```

3. 在 GitHub 创建 Pull Request
4. CI 检查通过后合并到 main
5. 自动触发部署

### 7.2 手动部署

#### 步骤 1: 导航到 GitHub Actions

1. 打开仓库页面
2. 点击 **Actions** 标签
3. 左侧菜单找到 **Deploy to EdgeOne**

#### 步骤 2: 点击运行

1. 点击 **Run workflow** 按钮
2. 选择分支: `main`
3. (可选) 添加部署说明
4. 点击 **Run workflow**

#### 步骤 3: 观察部署过程

部署日志实时更新:
```
✓ Checkout code (10s)
✓ Setup Node.js (15s)
✓ Setup Rust toolchain (30s)
✓ Install dependencies (45s)
✓ Build Rust/WASM module (2m 30s)
✓ Build Edge Functions (30s)
✓ Deploy to EdgeOne (1m 15s)
✓ Health check (5s)

Deployment completed successfully!
```

总部署时间通常在 3-5 分钟。

### 7.3 查看部署历史

#### 在 GitHub 查看

1. 仓库 → **Actions**
2. 查看 **Deploy to EdgeOne** workflow 的运行历史
3. 点击任意一次运行查看详细日志

#### 在 EdgeOne 查看

1. EdgeOne 控制台 → 项目 → **部署历史**
2. 可以看到所有部署记录:
   - 部署时间
   - 部署版本 (Git commit)
   - 部署状态
   - 部署日志

### 7.4 回滚部署

#### 方式 1: GitHub 回滚 (推荐)

```bash
# 回滚到上一个 commit
git reset --hard HEAD~1
git push --force origin main

# 或回滚到指定 commit
git reset --hard <commit-hash>
git push --force origin main
```

回滚会自动触发新的部署。

#### 方式 2: EdgeOne 回滚

1. EdgeOne 控制台 → 部署历史
2. 找到要回滚到的版本
3. 点击 **回滚** 按钮
4. 确认回滚操作

---

## 8. 生产环境检查清单

### 8.1 部署前检查

#### Supabase 配置

- [ ] Supabase 项目已创建
- [ ] 数据库迁移已执行
- [ ] 所有表已创建 (6 张表)
- [ ] 所有索引已创建 (14+ 个索引)
- [ ] RLS 已启用并验证
- [ ] API 密钥已复制并保存
- [ ] 自动备份已启用

#### EdgeOne 配置

- [ ] EdgeOne 账号已开通
- [ ] Pages 项目已创建
- [ ] GitHub 仓库已绑定
- [ ] 构建设置已配置
- [ ] 路由规则已配置
- [ ] 部署 URL 可访问
- [ ] API Token 已创建

#### GitHub Actions 配置

- [ ] Workflow 文件已配置
- [ ] 所有 Secrets 已添加 (10 个)
- [ ] 分支保护已启用 (可选)
- [ ] 部署流程已测试

#### 环境变量配置

- [ ] SUPABASE_URL ✓
- [ ] SUPABASE_ANON_KEY ✓
- [ ] SUPABASE_SERVICE_ROLE_KEY ✓
- [ ] JWT_SECRET ✓
- [ ] JWT_REFRESH_SECRET ✓
- [ ] ALLOWED_EMAILS ✓
- [ ] CORS_ALLOWED_ORIGINS ✓
- [ ] 其他可选变量已配置

### 8.2 部署后验证

#### 功能验证

1. **配置接口测试**
   ```bash
   curl https://your-deploy-url.pages.edgeone.com/api/config
   ```
   预期: 返回 JSON 配置信息

2. **Prelogin 测试**
   ```bash
   curl -X POST https://your-deploy-url.pages.edgeone.com/identity/accounts/prelogin \
     -H "Content-Type: application/json" \
     -d '{"email":"user@example.com"}'
   ```
   预期: 返回 KDF 参数

3. **CORS 测试**
   ```bash
   curl -I https://your-deploy-url.pages.edgeone.com/api/config
   ```
   预期: 响应头包含 `Access-Control-Allow-Origin`

#### 安全验证

- [ ] 环境变量不会泄露在日志中
- [ ] 敏感 API 需要 JWT 认证
- [ ] 非白名单邮箱无法注册
- [ ] CORS 配置正确
- [ ] HTTPS 已启用

#### 性能验证

- [ ] API 响应时间 < 500ms (P95)
- [ ] 数据库查询已使用索引
- [ ] CDN 缓存已生效

#### 监控验证

- [ ] 访问日志正常记录
- [ ] 错误率 < 1%
- [ ] 告警配置已完成

### 8.3 邮箱白名单测试

#### 测试单个邮箱

1. 设置 `ALLOWED_EMAILS=user@example.com`
2. 尝试用 `user@example.com` 注册 → ✅ 成功
3. 尝试用 `other@example.com` 注册 → ❌ 拒绝

#### 测试域名通配符

1. 设置 `ALLOWED_EMAILS=*@company.com`
2. 尝试用 `user1@company.com` 注册 → ✅ 成功
3. 尝试用 `admin@company.com` 注册 → ✅ 成功
4. 尝试用 `user@other.com` 注册 → ❌ 拒绝

#### 测试混合配置

1. 设置 `ALLOWED_EMAILS=admin@ex.com,*@company.com`
2. 尝试用 `admin@ex.com` 注册 → ✅ 成功
3. 尝试用 `user@company.com` 注册 → ✅ 成功
4. 尝试用 `other@ex.com` 注册 → ❌ 拒绝

---

## 9. 域名与 SSL 配置

### 9.1 添加自定义域名

#### 步骤 1: 准备域名

确保你拥有以下域名之一:
- `warden.yourdomain.com` (子域名)
- `passwords.yourdomain.com` (子域名)
- `warden-passwords.com` (独立域名)

#### 步骤 2: 在 EdgeOne 添加域名

1. EdgeOne 控制台 → 项目 → **域名**
2. 点击 **添加域名**
3. 输入你的域名: `warden.yourdomain.com`
4. 点击 **下一步**

#### 步骤 3: 获取 DNS 配置

EdgeOne 会提供 DNS 记录:

```
记录类型: CNAME
主机记录: warden
记录值: your-project.pages.edgeone.com
TTL: 600
```

#### 步骤 4: 配置 DNS

**腾讯云 DNS 配置**:

1. 登录腾讯云控制台 → **DNS 解析**
2. 点击你的域名
3. 点击 **添加记录**
4. 填写:
   - 主机记录: `warden`
   - 记录类型: `CNAME`
   - 线路类型: `默认`
   - 记录值: `your-project.pages.edgeone.com`
   - TTL: `600`
5. 点击 **保存**

**阿里云 DNS 配置**:

1. 登录阿里云控制台 → **云解析 DNS**
2. 找到你的域名，点击 **解析设置**
3. 点击 **添加解析**
4. 填写:
   - 记录类型: `CNAME`
   - 主机记录: `warden`
   - 记录值: `your-project.pages.edgeone.com`
   - TTL: `600`
5. 点击 **确定**

#### 步骤 5: 验证 DNS 生效

使用命令检查 DNS 是否生效:

```bash
# Windows
nslookup warden.yourdomain.com

# macOS/Linux
dig warden.yourdomain.com

# 在线工具
# 访问 https://dnschecker.org/
```

### 9.2 SSL 证书配置

#### 自动签发证书

EdgeOne 使用 **Let's Encrypt** 自动签发 SSL 证书:

1. DNS 配置完成后，EdgeOne 自动检测
2. 开始签发 SSL 证书 (通常 5-10 分钟)
3. 证书签发后自动应用到域名

#### 验证 SSL 证书

1. 访问 `https://warden.yourdomain.com`
2. 查看浏览器地址栏:
   - 应该显示 🔒 锁定图标
   - 点击锁可以看到证书信息

3. 使用在线工具验证:
   - https://www.ssllabs.com/ssltest/
   - 输入域名进行测试
   - 应该获得 A 或 A+ 评级

#### 证书自动续期

Let's Encrypt 证书有效期为 **90 天**，EdgeOne 会在过期前 **30 天**自动续期。

无需手动操作。

### 9.3 强制 HTTPS

在 EdgeOne 控制台配置:

1. 项目 → **安全**
2. 找到 **HTTPS 配置**
3. 启用 **强制 HTTPS 重定向**
4. 保存设置

这样所有 HTTP 请求会自动重定向到 HTTPS:
```
http://warden.yourdomain.com
    ↓ 自动重定向
https://warden.yourdomain.com
```

---

## 10. 性能与缓存优化

### 10.1 EdgeOne CDN 缓存配置

#### 配置缓存规则

1. EdgeOne 控制台 → 项目 → **缓存配置**
2. 点击 **添加缓存规则**

**规则 1: 配置接口 (可缓存)**
```
路径模式: /api/config
缓存时间: 300 秒 (5 分钟)
忽略参数: 无
```

**规则 2: Prelogin 接口 (可缓存)**
```
路径模式: /identity/accounts/prelogin
缓存时间: 300 秒 (5 分钟)
缓存键包含: 邮箱参数
```

**规则 3: 同步接口 (短暂缓存)**
```
路径模式: /api/sync
缓存时间: 60 秒 (1 分钟)
缓存键包含: Authorization 头
```

**规则 4: 其他 API (不缓存)**
```
路径模式: /api/*
缓存时间: 不缓存
```

**规则 5: 静态资源 (长时间缓存)**
```
路径模式: /static/*
缓存时间: 3600 秒 (1 小时)
```

### 10.2 Supabase 数据库优化

#### 启用自动 Vacuum

在 Supabase SQL Editor 执行:

```sql
-- 为高频更新表启用自动清理
ALTER TABLE ciphers SET (
  autovacuum_analyze_scale_factor = 0.05,
  autovacuum_vacuum_scale_factor = 0.1
);

ALTER TABLE sessions SET (
  autovacuum_vacuum_scale_factor = 0.1
);
```

#### 创建部分索引

只为活跃数据创建索引，减少索引大小:

```sql
-- 只为未删除的密码条目创建索引
CREATE INDEX idx_ciphers_active 
ON ciphers(user_id, revision_date DESC) 
WHERE deleted_date IS NULL;

-- 只为活跃会话创建索引
CREATE INDEX idx_sessions_active
ON sessions(user_id, expires_at DESC)
WHERE is_revoked = false;
```

#### 查询优化示例

优化前:
```sql
-- 全表扫描
SELECT * FROM ciphers WHERE user_id = 'xxx';
```

优化后:
```sql
-- 使用索引 idx_ciphers_active
SELECT * FROM ciphers 
WHERE user_id = 'xxx' 
AND deleted_date IS NULL;
```

### 10.3 Edge Functions 优化

#### 减少冷启动时间

1. **使用轻量级依赖**
   ```toml
   # Cargo.toml
   [dependencies]
   serde = { version = "1.0", features = ["derive"] }
   # 避免不必要的 features
   ```

2. **预编译常用代码**
   ```rust
   // 使用 lazy_static 预编译正则表达式
   lazy_static! {
       static ref EMAIL_REGEX: Regex = Regex::new(r"^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$").unwrap();
   }
   ```

3. **启用连接复用**
   ```javascript
   // 在 EdgeOne Edge Functions 中
   const cachedClient = new SupabaseClient(config);
   ```

#### 优化数据序列化

使用更高效的序列化格式:
```rust
// 使用 MessagePack 替代 JSON (可选)
use serde::{Serialize, Deserialize};
use rmp_serde;

#[derive(Serialize, Deserialize)]
pub struct User {
    pub id: Uuid,
    pub email: String,
}
```

---

## 11. 安全加固配置

### 11.1 EdgeOne WAF 配置

#### 启用 Web 应用防火墙

1. EdgeOne 控制台 → 项目 → **安全**
2. 启用 **WAF**
3. 配置防护规则:

**基础防护规则**
```
[✓] SQL 注入防护
    - 检测常见 SQL 注入模式
    - 阻止恶意查询

[✓] XSS 防护
    - 检测跨站脚本攻击
    - 过滤危险标签和属性

[✓] 路径遍历防护
    - 阻止 `../` 攻击
    - 限制目录访问

[✓] 命令注入防护
    - 阻止 shell 命令注入
```

### 11.2 速率限制配置

#### 配置全局限速

```
规则: 全局限速
阈值: 60 次/分钟
时间窗口: 60 秒
动作: 拒绝 (429 Too Many Requests)
```

#### 配置接口级限速

```
规则: 登录接口限速
路径: /identity/connect/token
阈值: 10 次/分钟
时间窗口: 60 秒
动作: 拒绝

规则: 注册接口限速
路径: /identity/accounts/register/finish
阈值: 5 次/小时
时间窗口: 3600 秒
动作: 拒绝

规则: 数据同步限速
路径: /api/sync
阈值: 10 次/分钟
时间窗口: 60 秒
动作: 拒绝
```

### 11.3 IP 访问控制

#### 添加 IP 白名单

```bash
# 只允许特定 IP 访问管理接口
允许 IP:
- 1.2.3.4 (你的办公 IP)
- 5.6.7.8 (你的家庭 IP)
- 192.168.1.0/24 (你的内网)
```

#### 添加 IP 黑名单

```bash
# 阻止已知恶意 IP
阻止 IP:
- 103.21.244.0/22 (已知扫描器)
- 185.220.101.0/24 (已知攻击源)
- 特定单个 IP
```

### 11.4 密钥轮换策略

#### 定期轮换密钥

**轮换周期**:
- JWT Secrets: 每 3 个月
- Supabase Service Role Key: 每 6 个月
- EdgeOne API Token: 每 1 年

**轮换步骤**:

1. 生成新密钥
2. 更新 GitHub Secrets
3. 更新 EdgeOne 环境变量
4. 部署新版本
5. 验证应用正常运行
6. 删除旧密钥

---

## 12. 监控与告警设置

### 12.1 EdgeOne 监控

#### 查看实时指标

1. EdgeOne 控制台 → 项目 → **监控**
2. 关注以下指标:

| 指标 | 说明 | 正常范围 |
|------|------|----------|
| QPS | 每秒请求数 | 根据实际使用 |
| 响应时间 | API 响应延迟 | < 500ms (P95) |
| 错误率 | 错误请求占比 | < 1% |
| 流量使用 | 带宽消耗 | < 80% 配额 |
| 缓存命中率 | CDN 缓存效率 | > 80% |

#### 配置告警规则

**告警 1: 错误率告警**
```
指标: 错误率
阈值: > 5%
持续时间: 5 分钟
通知方式: 邮件 + 短信
```

**告警 2: 响应时间告警**
```
指标: P95 响应时间
阈值: > 1s
持续时间: 5 分钟
通知方式: 邮件
```

**告警 3: 流量告警**
```
指标: 流量使用
阈值: > 80%
持续时间: 1 小时
通知方式: 邮件 + 站内信
```

### 12.2 Supabase 监控

#### 查看数据库性能

1. Supabase Dashboard → **Database** → **Performance**
2. 关注:
   - 慢查询
   - 连接数
   - 查询耗时
   - 缓存命中率

#### 查看日志

1. Supabase Dashboard → **Logs**
2. 筛选条件:
   - 时间范围
   - 日志级别
   - 关键词

### 12.3 集成外部监控 (可选)

#### 集成 Sentry (错误追踪)

```javascript
// 在 EdgeOne Edge Functions 中添加
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: 'your-sentry-dsn',
  environment: process.env.APP_ENV,
});
```

#### 集成 New Relic (APM)

参考 New Relic 文档集成 Edge Functions 监控。

---

## 13. 数据迁移方案

### 13.1 从 Cloudflare Workers 迁移

#### 步骤 1: 导出 Cloudflare D1 数据

```bash
# 使用 wrangler CLI
wrangler d1 export warden-db --output=backup.json
```

#### 步骤 2: 转换数据格式

创建转换脚本 `scripts/migrate_data.js`:

```javascript
const fs = require('fs');

// 读取 D1 导出数据
const d1Data = JSON.parse(fs.readFileSync('backup.json', 'utf8'));

// 转换为 Supabase 格式
const supabaseData = {
  users: d1Data.users.map(user => ({
    id: user.uuid,
    email: user.email,
    password_hash: user.passwordHash,
    password_salt: user.passwordSalt,
    key: user.key,
    created_at: user.createdAt,
    updated_at: user.updatedAt,
  })),
  ciphers: d1Data.ciphers.map(cipher => ({
    id: cipher.uuid,
    user_id: cipher.userId,
    folder_id: cipher.folderId,
    type: cipher.type,
    data: JSON.parse(cipher.data),
    favorites: cipher.favorite,
    created_at: cipher.createdAt,
    revision_date: cipher.revisionDate,
  })),
};

// 保存转换后的数据
fs.writeFileSync('supabase_import.json', JSON.stringify(supabaseData, null, 2));
```

#### 步骤 3: 导入到 Supabase

```bash
# 使用 Supabase CLI
supabase db reset

# 导入数据
supabase db import supabase_import.json
```

或使用 Supabase Dashboard:

1. 进入 Table Editor
2. 点击 **Import**
3. 上传 JSON 文件

### 13.2 数据验证

#### 检查记录数

```sql
-- 统计各表记录数
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'ciphers', COUNT(*) FROM ciphers
UNION ALL
SELECT 'folders', COUNT(*) FROM folders;
```

#### 检查数据完整性

```sql
-- 检查孤立记录
SELECT c.id as orphan_cipher_id
FROM ciphers c
LEFT JOIN users u ON c.user_id = u.id
WHERE u.id IS NULL;

-- 检查重复记录
SELECT email, COUNT(*) as count
FROM users
GROUP BY email
HAVING COUNT(*) > 1;
```

### 13.3 回滚方案

如果迁移出现问题:

#### 方式 1: 使用 Supabase PITR

Pro Plan 支持时间点恢复:
1. Supabase Dashboard → Database → Backups
2. 选择要恢复到的时间点
3. 点击 **Restore**

#### 方式 2: 从备份恢复

```bash
# 从备份恢复
supabase db reset

# 或手动恢复
psql -h db.project-id.supabase.co -U postgres -f backup.sql
```

---

## 14. 故障排查指南

### 14.1 部署失败

#### 问题: GitHub Actions 构建失败

**错误信息**: `Build failed with exit code 1`

**排查步骤**:
1. 检查构建日志
2. 确认 `Cargo.toml` 和 `package.json` 格式正确
3. 确认所有依赖已正确声明
4. 尝试本地构建:
   ```bash
   npm ci
   cargo build --target wasm32-wasi --release
   ```

#### 问题: EdgeOne 部署失败

**错误信息**: `Deployment failed: Invalid API token`

**排查步骤**:
1. 确认 `EDGEONE_API_TOKEN` 正确
2. 确认 `EDGEONE_PROJECT_ID` 正确
3. 检查 Token 是否已过期
4. 重新生成 Token 并更新 Secret

### 14.2 数据库连接失败

#### 问题: Supabase API 连接超时

**错误信息**: `Connection timeout`

**排查步骤**:
1. 检查 `SUPABASE_URL` 格式正确
2. 确认 Supabase 项目未暂停
3. 检查网络连接
4. 查看 Supabase 状态页: https://status.supabase.com/

#### 问题: API 认证失败

**错误信息**: `Invalid API key`

**排查步骤**:
1. 确认 `SUPABASE_ANON_KEY` 正确
2. 确认 Key 未过期
3. 检查是否使用错误的 Key (anon vs service_role)

### 14.3 API 错误

#### 问题: 401 Unauthorized

**原因**: JWT Token 无效或过期

**解决**:
1. 检查 `JWT_SECRET` 是否配置
2. 检查 Token 格式是否正确
3. 尝试重新登录获取新 Token

#### 问题: 403 Forbidden

**原因**: 访问被拒绝

**排查**:
1. 检查邮箱是否在白名单
2. 检查 CORS 配置
3. 检查 RLS 策略是否正确

#### 问题: 429 Too Many Requests

**原因**: 超出速率限制

**解决**:
1. 检查速率限制配置
2. 降低请求频率
3. 考虑增加限制阈值

### 14.4 性能问题

#### 问题: API 响应慢

**排查步骤**:
1. 检查 Supabase 慢查询日志
2. 确认索引是否被使用
3. 检查 CDN 缓存命中率
4. 查看函数冷启动时间

#### 问题: 数据库连接池耗尽

**排查步骤**:
1. 检查 `DB_POOL_SIZE` 配置
2. 检查是否有长事务未提交
3. 查看 Supabase 连接数监控

---

## 15. 成本与扩展性分析

### 15.1 免费额度分析

#### EdgeOne 免费版

| 资源 | 额度 | 备注 |
|------|------|------|
| 请求数 | 10 万次/月 | 适合个人使用 |
| 流量 | 10GB/月 | 可满足基本需求 |
| CDN | 全球加速 | 覆盖 200+ 节点 |
| SSL 证书 | 免费 | Let's Encrypt |
| WAF | 基础防护 | SQL 注入、XSS |

#### Supabase 免费版

| 资源 | 额度 | 备注 |
|------|------|------|
| 数据库 | 500MB | 可存储约 5000 个密码条目 |
| 文件存储 | 1GB | 如需附件存储 |
| API 调用 | 5 万次/月 | 与 EdgeOne 配合使用 |
| 带宽 | 2GB/月 | 仅 API 调用 |
| 备份 | 7 天保留 | 自动备份 |

### 15.2 付费升级方案

#### 需要升级的信号

- EdgeOne: 请求数 > 8 万/月 或流量 > 8GB/月
- Supabase: 数据库 > 400MB 或 API 调用 > 4 万/月

#### Supabase Pro Plan

| 资源 | Pro Plan | 价格 |
|------|----------|------|
| 数据库 | 8GB | $25/月 |
| 文件存储 | 100GB | 包含 |
| API 调用 | 50 万/月 | 包含 |
| 带宽 | 50GB/月 | 包含 |
| PITR | 支持 | 额外费用 |
| 每日备份 | 支持 | 包含 |

#### EdgeOne 基础版

| 资源 | 基础版 | 价格 |
|------|--------|------|
| 请求数 | 100 万/月 | ¥99/月 |
| 流量 | 100GB/月 | 包含 |
| 高级防护 | 支持 | 包含 |

### 15.3 扩展性考虑

#### 水平扩展

EdgeOne 和 Supabase 都支持水平扩展:

**EdgeOne**:
- CDN 自动扩展
- 全球节点负载均衡
- 无需手动配置

**Supabase**:
- 连接池自动扩展
- 数据库自动扩容
- 高可用架构

#### 架构优化建议

1. **使用 CDN 缓存**: 减少直接访问 API
2. **数据分页**: 避免一次性加载大量数据
3. **异步处理**: 使用队列处理耗时操作
4. **读写分离**: 复制数据库用于读操作

---

## 总结

本文档提供了 EdgeOne + Supabase 架构的完整线上部署指南。按照本指南操作，你将能够:

✅ 完成项目部署到生产环境
✅ 配置完整的安全防护
✅ 优化系统性能
✅ 设置监控和告警
✅ 故障时快速恢复

如有任何问题，请参考故障排查指南或联系技术支持。

