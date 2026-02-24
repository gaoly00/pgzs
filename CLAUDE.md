# CLAUDE.md — SmartVal 项目上下文

## 项目概述

SmartVal 是基于 Next.js 16 App Router 的房地产估价管理系统。支持多租户、多估价方法（比较法/成本法/收益法等）、FortuneSheet 在线工作簿、Word 模板报告生成。

## 技术栈

- Next.js 16 (App Router, Turbopack)
- TypeScript, Tailwind CSS, shadcn/ui
- Zustand (状态管理, persist to localStorage)
- SQLite (better-sqlite3, WAL 模式) — 所有持久化数据
- FortuneSheet (在线电子表格)
- TipTap (富文本编辑器, 报告页)
- docx (服务端 Word 生成), mammoth (docx→HTML)
- bcryptjs (密码哈希), HMAC (会话签名)

## 关键目录结构

```
src/
├── lib/
│   ├── db/
│   │   ├── index.ts          # SQLite 单例连接 (WAL, FK, busy_timeout=5000)
│   │   ├── schema.ts         # 10 张表的 CREATE TABLE IF NOT EXISTS
│   │   └── migrate-json.ts   # 一次性 JSON→SQLite 迁移脚本
│   ├── auth/
│   │   ├── store.ts          # 用户/会话 CRUD (SQLite prepared statements)
│   │   ├── session.ts        # Token 生成, HMAC 签名, Cookie, verifySession
│   │   ├── rate-limiter.ts   # 速率限制+登录锁定 (SQLite 持久化)
│   │   ├── password.ts       # bcryptjs hash/verify
│   │   ├── validators.ts     # 用户名/密码校验规则
│   │   └── with-auth.ts      # withAuth() HOF
│   ├── repositories/
│   │   ├── tenant-repo.ts    # 租户 CRUD
│   │   ├── project-repo.ts   # 项目 CRUD (ServerProject = SharedProject)
│   │   └── sheet-repo.ts     # 工作簿 sheet CRUD (UPSERT)
│   ├── api-client.ts         # 统一前端 fetch 封装 (apiGet/Post/Patch/Delete)
│   ├── snapshot-store.ts     # 报告快照 (SQLite)
│   ├── audit-logger.ts       # 审计日志 (SQLite)
│   ├── template-engine.ts    # Word 模板处理 + 导出 (调用服务端 API)
│   └── report-template.ts    # 默认 HTML 报告模板生成器
├── types/
│   ├── shared.ts             # SharedProject — 前后端共享的数据库结构
│   └── index.ts              # Project extends SharedProject + 前端专属字段
├── store/index.ts            # Zustand store (项目/工作簿/估价操作)
├── middleware.ts             # Edge Runtime HMAC Cookie 验证
└── app/
    ├── api/                  # ~21 个 API 路由
    ├── (auth)/               # 登录/注册/忘记密码
    └── (dashboard)/          # 受保护的业务页面
```

## 数据库表 (SQLite: data/smartval.db)

tenants, users, sessions, projects, sheets, snapshots, audit_logs, word_templates, rate_limits, login_failures

## 近期架构变更 (2025-02 批次)

### 已完成

1. **JSON→SQLite 迁移** (`0b066f8`)
   - 所有 JSON 文件存储替换为 SQLite (better-sqlite3)
   - 二进制文件 (.docx/.xlsx) 保留磁盘
   - `npm run migrate:json` 可导入旧数据
   - next.config.ts 添加 `serverExternalPackages: ['better-sqlite3']`

2. **安全头 + SESSION_SECRET** (`4ffc8d7`)
   - next.config.ts 添加 CSP, HSTS, X-Frame-Options 等 7 个安全头
   - SESSION_SECRET 不再有硬编码默认值，未设置则抛错
   - .env.local 必须包含 SESSION_SECRET

3. **统一 API 客户端** (`c154d55`)
   - `src/lib/api-client.ts`: apiGet/apiPost/apiPatch/apiDelete/apiPostForm
   - 返回 `ApiResult<T> = { ok, data } | { ok, error }`
   - 401 自动跳转 /login
   - 替换了 12+ 文件中的散落 fetch 调用
   - 保留的原始 fetch: login/register 页面, blob 下载, PUT 请求

4. **速率限制持久化** (`5b559d1`)
   - rate-limiter.ts 从内存 Map 改为 SQLite
   - 重启后锁定状态保持

5. **统一类型定义** (`235dfe7`)
   - `SharedProject` (types/shared.ts) 为数据库真实结构
   - 前端 `Project extends SharedProject` 添加可选客户端字段
   - `ServerProject` 现为 SharedProject 的类型别名
   - salesCompCases/costItems/conclusion 变为可选，所有访问加了 `?? []` 安全默认

6. **报告导出迁移到服务端** (`ed51ef6`)
   - PDF: 服务端生成带 A4 打印样式的 HTML → 客户端 window.print()
   - Word: 服务端 docx 库生成结构化文档
   - 新增 `html-pdf` 格式端点
   - template-engine 的 exportToWord/exportToPdf 改为调用 API

### 已知待办 / 注意事项

- `src/app/actions/valuation.ts` 已废弃但仍存在，无鉴权，应删除
- middleware.ts 使用 Edge Runtime (Web Crypto)，session.ts 使用 Node crypto — 两套 HMAC 实现
- withAuth() HOF 仅部分路由使用，多数路由仍内联 verifySession()
- 无测试框架，无测试文件
- FortuneSheet 工作簿 PUT 保存仍用原始 fetch (api-client 无 apiPut)
- 前端 Zustand store 仍有本地 createProject 回退逻辑

## 环境变量 (.env.local)

```
SESSION_SECRET=<必填，无默认值>
ADMIN_RESET_SECRET=<管理员密码重置密钥>
```

## 常用命令

```bash
npm run dev          # 开发服务器
npm run build        # 生产构建
npm run migrate:json # JSON 数据迁移到 SQLite
```
