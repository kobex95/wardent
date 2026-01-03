# 本地项目上传到 GitHub 完整指南

> 适用于新手的详细分步骤教程

---

## 第一步：在 GitHub 创建新仓库

### 1.1 登录 GitHub
1. 访问 https://github.com
2. 点击右上角 **Sign in** 登录账号（如果没有账号先点击 **Sign up** 注册）

### 1.2 创建新仓库
1. 登录后，点击右上角的 **+** 号
2. 在下拉菜单中选择 **New repository**

### 1.3 填写仓库信息
填写以下信息：

| 项目 | 说明 | 示例 |
|------|------|------|
| Repository name | 仓库名称 | `warden-worker` |
| Description | 仓库描述（可选） | `Bitwarden 兼容的密码管理服务器` |

### 1.4 配置仓库选项
选择以下选项：

```
☑️ Public（公开）或 ☐ Private（私有）
  - Public：任何人都可以访问
  - Private：只有你可以访问（推荐选择此选项，因为包含敏感配置）

☐ Add a README file
  - 不要勾选！我们稍后手动创建

☐ Add .gitignore
  - 不要勾选！我们稍后手动创建

☐ Choose a license
  - 不要勾选！我们稍后手动创建
```

⚠️ **重要**：三个选项都不要勾选，保持全部未勾选状态

### 1.5 创建仓库
点击页面底部的绿色按钮 **Create repository**

### 1.6 复制仓库地址
创建成功后，页面会显示仓库地址：

```
Quick setup — if you've done this kind of thing before

…or create a new repository on the command line
echo "# warden-worker" >> README.md
git init
git add README.md
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/your-username/warden-worker.git
git push -u origin main
```

**复制以下 URL**（点击右侧的 📋 复制图标）：
```
https://github.com/your-username/warden-worker.git
```

或者使用 SSH 地址（如果已配置 SSH）：
```
git@github.com:your-username/warden-worker.git
```

将这个地址记下来，后面步骤会用到。

---

## 第二步：本地 Git 环境配置

### 2.1 检查 Git 是否已安装

打开命令行（Windows 按 `Win + R`，输入 `cmd` 或 `PowerShell`）：

```bash
# 检查 Git 版本
git --version
```

**如果显示版本号**（如 `git version 2.42.0`），说明已安装，跳到步骤 2.3。

**如果提示命令不存在**，按步骤 2.2 安装。

### 2.2 安装 Git

#### Windows 系统
1. 访问 https://git-scm.com/download/win
2. 下载安装程序（自动识别你的系统）
3. 运行安装程序，一路点击 **Next** 使用默认选项
4. 完成后重新打开命令行窗口

### 2.3 配置 Git 用户信息

**重要**：首次使用 Git 必须配置用户信息，否则无法提交代码。

```bash
# 配置用户名（替换为你的 GitHub 用户名）
git config --global user.name "你的GitHub用户名"

# 配置邮箱（替换为你的 GitHub 注册邮箱）
git config --global user.email "your-email@example.com"
```

**示例**：
```bash
git config --global user.name "zhangsan"
git config --global user.email "zhangsan@example.com"
```

### 2.4 验证配置

```bash
# 查看配置信息
git config --global user.name
git config --global user.email

# 或查看全部配置
git config --global --list
```

应该显示你刚才设置的用户名和邮箱。

---

## 第三步：初始化本地 Git 仓库

### 3.1 进入项目目录

打开命令行，切换到你的项目目录：

**Windows 示例**：
```bash
# 进入 D 盘的 APP/warden-worker 目录
cd D:\APP\warden-worker

# 或使用相对路径（如果当前已在 D:\APP）
cd .\warden-worker
```

### 3.2 检查当前目录

```bash
# 查看当前目录（确认是否正确）
cd

# 查看目录内容
dir
```

### 3.3 初始化 Git 仓库

```bash
# 初始化仓库
git init
```

**预期输出**：
```
Initialized empty Git repository in D:/APP/warden-worker/.git/
```

**说明**：
- `.git` 目录是 Git 的核心，记录所有版本信息
- 这个目录是隐藏的，正常情况下不需要手动操作

### 3.4 检查仓库状态

```bash
# 查看仓库状态
git status
```

**预期输出**：
```
On branch main

No commits yet

Untracked files:
  (use "git add <file>..." to include in what will be committed)
        .github/
        docs/
        edgeone-config.toml
        Cargo-edgeone.toml
        package.json
        ...
```

**说明**：
- `On branch main`：当前在 `main` 分支
- `No commits yet`：还没有任何提交
- `Untracked files`：未跟踪的文件（需要添加到 Git）

---

## 第四步：创建 .gitignore 文件

### 4.1 创建 .gitignore 文件

在项目根目录创建 `.gitignore` 文件，排除不需要提交的文件：

```bash
# 使用记事本创建
notepad .gitignore
```

### 4.2 编辑 .gitignore 文件

将以下内容粘贴到 `.gitignore` 文件中：

```gitignore
# ========== 依赖和构建产物 ==========
node_modules/
target/
dist/
build/
*.wasm
*.o
*.a

# ========== 环境变量和密钥 ==========
.env
.env.local
.env.*.local
*.key
*.pem
credentials.json
config.local.toml

# ========== IDE 和编辑器 ==========
.vscode/
.idea/
*.swp
*.swo
*~
.DS_Store
Thumbs.db

# ========== 日志 ==========
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# ========== 临时文件 ==========
tmp/
temp/
*.tmp
.cache/

# ========== 测试覆盖率 ==========
coverage/
.nyc_output/

# ========== 操作系统 ==========
.DS_Store
Thumbs.db

# ========== Supabase ==========
supabase/.branches/
supabase/.temp/
```

### 4.3 保存文件

- **记事本**：`Ctrl + S` 保存，然后关闭
- **VS Code**：`Ctrl + S` 保存

---

## 第五步：添加文件到暂存区

### 5.1 添加所有文件

```bash
# 添加所有文件（包括 .gitignore）
git add .
```

### 5.2 查看暂存状态

```bash
# 查看哪些文件被添加
git status
```

**预期输出**：
```
On branch main

No commits yet

Changes to be committed:
  (use "git rm --cached <file>..." to unstage)
        new file:   .github/workflows/edgeone-deploy.yml
        new file:   .gitignore
        new file:   Cargo-edgeone.toml
        new file:   docs/DEPLOYMENT_GUIDE.md
        new file:   docs/QUICK_DEPLOY.md
        ...
```

**说明**：
- `Changes to be committed`：准备提交的文件（绿色显示）
- `new file`：新添加的文件

### 5.3 查看具体变更内容（可选）

```bash
# 查看暂存区的详细变更
git diff --cached

# 查看某个文件的变更
git diff --cached 文件名
```

---

## 第六步：提交代码到本地仓库

### 6.1 第一次提交

```bash
# 提交代码
git commit -m "Initial commit: 添加 EdgeOne + Supabase 部署配置"
```

**预期输出**：
```
[main (root-commit) abc1234] Initial commit: 添加 EdgeOne + Supabase 部署配置
 35 files changed, 2847 insertions(+)
 create mode 100644 .github/workflows/edgeone-deploy.yml
 create mode 100644 .gitignore
 create mode 100644 Cargo-edgeone.toml
 ...
```

**说明**：
- `-m` 后面是提交信息（commit message），简洁明了地说明这次提交的内容
- `[main (root-commit) abc1234]`：提交 ID（哈希值），前几位可以用来引用这次提交

### 6.2 提交信息规范

好的提交信息示例：

```bash
# 简短描述
git commit -m "添加数据库迁移脚本"

# 带详细说明
git commit -m "添加 Supabase 数据库迁移脚本

- 创建 6 张核心表
- 添加 14+ 个索引
- 配置 RLS 策略
- 添加触发器"
```

### 6.3 查看提交历史

```bash
# 查看提交历史（简要）
git log

# 查看提交历史（详细）
git log --oneline --graph --all
```

---

## 第七步：添加远程仓库地址

### 7.1 添加远程仓库

```bash
# 添加远程仓库（替换为你在第一步复制的地址）
git remote add origin https://github.com/your-username/warden-worker.git
```

**说明**：
- `origin`：远程仓库的默认名称
- 你可以替换为其他名称，但 `origin` 是约定俗成的

### 7.2 验证远程仓库

```bash
# 查看远程仓库
git remote -v
```

**预期输出**：
```
origin  https://github.com/your-username/warden-worker.git (fetch)
origin  https://github.com/your-username/warden-worker.git (push)
```

### 7.3 修改远程仓库地址（如果地址错误）

```bash
# 先删除旧的远程仓库
git remote remove origin

# 再添加新的地址
git remote add origin https://github.com/correct-username/warden-worker.git
```

或直接修改：
```bash
# 修改远程仓库地址
git remote set-url origin https://github.com/correct-username/warden-worker.git
```

---

## 第八步：推送代码到 GitHub

### 8.1 首次推送

```bash
# 推送代码到远程仓库的 main 分支
git push -u origin main
```

**参数说明**：
- `-u`：设置上游分支，以后推送只需要 `git push` 即可
- `origin`：远程仓库名称
- `main`：本地分支名称

### 8.2 输入 GitHub 凭证

如果你使用 HTTPS 方式，首次推送会要求输入凭证：

**Windows 会自动弹出登录窗口**

1. 弹出 GitHub 登录页面
2. 输入你的 GitHub 账号和密码
3. 完成两步验证（如果已启用）
4. 授权 Git 凭证管理器

⚠️ **重要**：从 2021 年起，GitHub 不再支持使用登录密码推送代码，必须使用 **Personal Access Token (PAT)** 或使用凭证管理器自动登录。

#### 如何创建 Personal Access Token（手动方式）？

1. 登录 GitHub
2. 点击右上角头像 → **Settings**
3. 左侧菜单 **Developer settings** → **Personal access tokens** → **Tokens (classic)**
4. 点击 **Generate new token** → **Generate new token (classic)**
5. 填写信息：
   - **Note**：`Git Push Token`（或其他描述）
   - **Expiration**：选择过期时间（建议 90 天或更长）
   - **Scopes**：勾选 **repo**（完整的仓库权限）
6. 点击 **Generate token**
7. **复制生成的 token**（格式：`ghp_xxxxxxxxxxxx`）
8. 在 Git 推送命令行中粘贴这个 token作为密码

### 8.3 预期输出

```
Enumerating objects: 42, done.
Counting objects: 100% (42/42), done.
Delta compression using up to 8 threads.
Compressing objects: 100% (35/35), done.
Writing objects: 100% (42/42), 45.23 KiB | 2.12 MiB/s, done.
Total 42 (delta 5), reused 0 (delta 0), pack-reused 0
remote: Resolving deltas: 100% (5/5), done.
To https://github.com/your-username/warden-worker.git
 * [new branch]      main -> main
branch 'main' set up to track 'origin/main'.
```

### 8.4 验证推送结果

打开 GitHub 仓库页面，应该看到：
- 所有文件已上传
- README.md 显示在首页
- 提交信息显示在 "Commits" 页面

---

## 第九步：后续操作指南

### 9.1 查看仓库状态

```bash
# 查看当前状态
git status
```

**预期输出**：
```
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
```

### 9.2 修改文件后的提交流程

当修改了文件后，按以下步骤提交：

```bash
# 1. 查看哪些文件被修改
git status

# 2. 查看具体修改内容
git diff

# 3. 添加修改的文件（添加所有修改）
git add .

# 或只添加特定文件
git add 文件名

# 4. 提交到本地仓库
git commit -m "修改说明"

# 5. 推送到 GitHub
git push
```

### 9.3 从 GitHub 拉取最新代码

如果其他人在 GitHub 上修改了代码，或者你在其他电脑上修改：

```bash
# 拉取最新代码
git pull

# 或先拉取再合并
git fetch
git merge origin/main
```

### 9.4 查看提交历史

```bash
# 简要查看
git log --oneline

# 详细查看（包含时间、作者）
git log --oneline --all --graph

# 查看某次提交的详细信息
git show <commit-id>
```

---

## 常见问题排查

### 问题 1：提示 `fatal: not a git repository`

**原因**：当前目录不是 Git 仓库

**解决**：
```bash
# 确认在项目根目录
cd /path/to/warden-worker

# 初始化仓库
git init
```

### 问题 2：提示 `error: failed to push some refs`

**原因**：远程仓库有本地没有的提交

**解决**：
```bash
# 先拉取远程代码
git pull --rebase

# 再推送
git push
```

### 问题 3：推送时认证失败

**原因**：凭证错误或过期

**解决**：
```bash
# 清除凭证缓存
git credential-manager-core erase

# 重新推送，会要求重新输入
git push
```

### 问题 4：提交时忘记添加文件

**解决**：
```bash
# 撤销最后一次提交（保留修改）
git reset --soft HEAD~1

# 重新添加文件
git add .

# 重新提交
git commit -m "新的提交信息"
```

### 问题 5：推送后发现代码有问题

**解决**：
```bash
# 回退到上一次提交
git reset --hard HEAD~1

# 或回退到指定提交
git reset --hard <commit-id>

# 强制推送（危险操作！）
git push --force

# ⚠️ 慎用 --force，会覆盖远程仓库的提交
```

---

## 完整操作流程总结

```bash
# ========== 1. 初始化 ==========
git config --global user.name "你的用户名"
git config --global user.email "你的邮箱"
cd D:\APP\warden-worker
git init

# ========== 2. 创建 .gitignore ==========
# 使用记事本创建文件：notepad .gitignore
# 粘贴文档中的 .gitignore 内容并保存

# ========== 3. 添加和提交 ==========
git add .
git commit -m "Initial commit"

# ========== 4. 连接远程仓库 ==========
git remote add origin https://github.com/your-username/warden-worker.git

# ========== 5. 推送到 GitHub ==========
git push -u origin main
```

---

## Git 常用命令速查表

| 命令 | 说明 |
|------|------|
| `git init` | 初始化 Git 仓库 |
| `git clone <url>` | 克隆远程仓库 |
| `git add <file>` | 添加文件到暂存区 |
| `git add .` | 添加所有文件 |
| `git commit -m "msg"` | 提交到本地仓库 |
| `git push` | 推送到远程仓库 |
| `git pull` | 拉取远程更新 |
| `git status` | 查看仓库状态 |
| `git log` | 查看提交历史 |
| `git diff` | 查看未暂存的修改 |
| `git branch` | 查看分支 |
| `git checkout -b <branch>` | 创建并切换分支 |
| `git merge <branch>` | 合并分支 |

---

## 下一步

上传完成后，可以继续：

1. **创建 GitHub Actions**：配置自动部署
2. **添加 README.md**：编写项目说明
3. **配置分支保护**：设置 main 分支的保护规则
4. **邀请协作者**：如果是团队项目

---

## 技术支持

- Git 官方文档：https://git-scm.com/doc
- GitHub 文档：https://docs.github.com
- Git 教程：https://www.liaoxuefeng.com/wiki/896043488029600
