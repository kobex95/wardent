# Warden-Worker 快速部署指南

> 基于 EdgeOne + Supabase 的单一路径部署方案

---

## 部署架构

```
用户 → EdgeOne Edge Functions → Supabase PostgreSQL
```

---

## 第一步：配置 Supabase

### 1.1 创建项目
1. 访问 https://supabase.com/signup
2. 创建新项目 `warden-worker`
3. 选择区域：Northeast Asia (Tokyo) 或 Southeast Asia (Singapore)
4. 等待项目初始化完成（2-5 分钟）

### 1.2 执行数据库迁移
1. 进入项目 → 左侧菜单 **SQL Editor** → **New Query**
2. 复制 `supabase/migrations/001_init.sql` 全部内容
3. 粘贴并点击 **Run**
4. 确认看到 `Success. No rows returned`

### 1.3 获取 API 密钥
进入 **Settings** → **API**，复制以下 3 个密钥：

```
SUPABASE_URL = https://your-project-id.supabase.co
SUPABASE_ANON_KEY = eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY = eyJhbGci...
```

⚠️ **Service Role Key 绝不能暴露在前端代码或 Git 仓库中**

### 1.4 生成 JWT 密钥

```bash
# 生成两个不同的密钥
openssl rand -base64 64  # JWT_SECRET
openssl rand -base64 64  # JWT_REFRESH_SECRET
```

---

## 第二步：配置 EdgeOne

### 2.1 注册和开通
1. 访问 https://console.cloud.tencent.com
2. 注册账号并完成实名认证
3. 搜索 "EdgeOne" → 点击 "立即开通" → 选择免费版

### 2.2 创建 Pages 项目
1. 左侧菜单 **Pages** → **创建项目**
2. 选择 **导入 Git 仓库** → **绑定 GitHub**
3. 选择仓库：`your-username/warden-worker`
4. 选择分支：`main`
5. Framework：Auto-detect
6. 点击 **创建项目**

### 2.3 配置环境变量
进入项目 → **环境变量** → 依次添加：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `SUPABASE_URL` | `https://your-project-id.supabase.co` | Supabase 地址 |
| `SUPABASE_ANON_KEY` | `eyJhbGci...` | 客户端密钥 |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGci...` | 服务端密钥（密文） |
| `JWT_SECRET` | `64字符随机字符串` | JWT 签名密钥（密文） |
| `JWT_REFRESH_SECRET` | `另一个64字符随机字符串` | JWT 刷新密钥（密文） |
| `ALLOWED_EMAILS` | `user@example.com,*@company.com` | 允许注册的邮箱 |
| `CORS_ALLOWED_ORIGINS` | `https://warden.yourdomain.com` | CORS 允许的域名 |
| `APP_ENV` | `production` | 运行环境 |
| `LOG_LEVEL` | `info` | 日志级别 |

### 2.4 配置路由
进入 **路由配置** → 添加：

```
路由模式: /identity/*    → 处理函数: identity-handler
路由模式: /api/*          → 处理函数: api-handler
```

### 2.5 创建 API Token
进入 **设置** → **访问密钥** → **创建密钥**：
- 名称：`GitHub Actions Deploy`
- 权限：Deploy
- 过期时间：1 年

⚠️ **只显示一次，立即复制保存**

---

## 第三步：配置 GitHub Actions

### 3.1 添加 GitHub Secrets
打开仓库 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

添加以下 Secrets：

| Secret 名称 | 值 | 说明 |
|-------------|-----|------|
| `EDGEONE_API_TOKEN` | `e1at_xxxxxx` | EdgeOne API Token |
| `EDGEONE_PROJECT_ID` | `your-project-id` | 从部署 URL 提取 |
| `EDGEONE_DEPLOY_URL` | `https://your-project.pages.edgeone.com` | 部署 URL |

### 3.2 验证 Workflow
确认 `.github/workflows/edgeone-deploy.yml` 文件存在且配置正确。

---

## 第四步：触发部署

### 4.1 自动部署
推送代码到 `main` 分支即可自动触发：

```bash
git add .
git commit -m "部署到 EdgeOne"
git push origin main
```

### 4.2 手动部署
1. 打开仓库 → **Actions** 标签
2. 找到 **Deploy to EdgeOne** workflow
3. 点击 **Run workflow** → 选择 `main` 分支 → **Run workflow**

### 4.3 验证部署
部署完成后：
1. 访问部署 URL：`https://your-project.pages.edgeone.com`
2. 访问 `https://your-project.pages.edgeone.com/api/config` 测试 API
3. 在 EdgeOne 控制台查看部署日志

---

## 第五步：配置域名（可选）

### 5.1 添加自定义域名
1. EdgeOne 控制台 → 项目 → **域名** → **添加域名**
2. 输入域名：`warden.yourdomain.com`
3. 复制 DNS 配置：
   ```
   类型: CNAME
   主机记录: warden
   记录值: your-project.pages.edgeone.com
   ```

### 5.2 配置 DNS
在你的域名 DNS 提供商添加上述 CNAME 记录。

### 5.3 验证
1. 访问 `https://warden.yourdomain.com`
2. 查看浏览器地址栏确认 HTTPS 生效

---

## 生产环境检查清单

- [ ] Supabase 项目创建完成
- [ ] 数据库迁移已执行
- [ ] API 密钥已获取并保存
- [ ] JWT 密钥已生成
- [ ] EdgeOne 账号已开通
- [ ] Pages 项目已创建
- [ ] GitHub 仓库已绑定
- [ ] 所有环境变量已配置
- [ ] 路由规则已设置
- [ ] API Token 已创建
- [ ] GitHub Secrets 已添加
- [ ] 首次部署成功
- [ ] API 测试通过
- [ ] 域名已配置（可选）

---

## 常见问题

### Q: 部署失败怎么办？
1. 检查 GitHub Actions 日志
2. 确认所有 Secret 配置正确
3. 验证 API Token 未过期

### Q: API 调用返回 401？
检查 JWT_SECRET 配置是否正确，确保与 EdgeOne 环境变量一致。

### Q: 邮箱注册被拒绝？
检查 ALLOWED_EMAILS 配置，确保邮箱在白名单中。

### Q: 如何监控服务？
- EdgeOne 控制台：查看 QPS、响应时间、错误率
- Supabase Dashboard：查看数据库性能、慢查询

---

## 成本估算

### 免费额度（个人使用）

| 服务 | 资源 | 额度 |
|------|------|------|
| EdgeOne | 请求数 | 10 万次/月 |
| EdgeOne | 流量 | 10GB/月 |
| Supabase | 数据库 | 500MB |
| Supabase | API 调用 | 5 万次/月 |

**适用场景**：个人或小团队使用，约 50 个用户，5000 个密码条目

### 付费升级（超出免费额度）

- EdgeOne 基础版：¥99/月
- Supabase Pro：$25/月

---

## 技术支持

- EdgeOne 文档：https://cloud.tencent.com/document/product/1552
- Supabase 文档：https://supabase.com/docs
- GitHub Issues：在仓库提出问题
