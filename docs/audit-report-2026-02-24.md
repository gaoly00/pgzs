# SmartVal 产品级差距审计报告 + 技术改造路线图

> 生成时间：2026-02-24 · 基于代码库全量阅读

---

## 结论摘要（1 页版）

### 当前定位
SmartVal 是一个**单租户/前端主导**的 MVP 原型，项目数据通过 `zustand persist + localStorage` 存储，
认证通过本地 JSON 文件 (`data/users.json`) + Cookie Session 实现。
距离"行业级多租户 SaaS"在**数据隔离、持久化、模板治理、权限闭环**四个维度存在系统性差距。

### P0 关键问题（必须立即解决，否则无法交付给第二家公司）

| # | 问题 | 根因 | 后果 |
|---|------|------|------|
| 1 | **全部项目数据存在 localStorage** | `zustand persist → localStorage` (`smartval.store.v2`) | 清浏览器缓存 = 丢失所有项目；无法多设备共享；localStorage 5MB 上限导致大工作簿静默丢失 |
| 2 | **无 tenantId/companyId** | `projectsByUser[userId]` 仅按用户隔离，不按公司 | 无法实现公司 A 看不到公司 B 的数据 |
| 3 | **Word 模板 base64 存 localStorage** | `reportTemplates` 数组含 `docxBase64` 字段 | 一个 1MB docx ≈ 1.4MB base64，2 个模板就可能撑爆 localStorage |
| 4 | **API 层无统一鉴权中间件** | 每个 route 各自调 `verifySession()`，部分 API 完全无鉴权 | 越权调用风险 |

### 最短路线（Phase 1 → 4~6 周）
```
Sprint 1 (2w): 持久化层 + 多租户数据模型
Sprint 2 (2w): 模板治理 + 保存闭环 + RBAC 补全
Sprint 3 (1w): 审计日志 + 自测验收
```

---

## Part A：现状系统边界图

### A.1 核心模块与文件映射

```
SmartVal/src/
├── types/index.ts           ← 全局数据类型（Project, ReportTemplate, SalesAnchor 等）
├── store/index.ts           ← Zustand Store（★ 唯一数据权威来源，520 行）
│   ├── projectsByUser       ← Record<userId, Project[]>，按用户隔离
│   ├── reportTemplates      ← ReportTemplate[]（全局共享，非按用户）
│   └── persist → localStorage 'smartval.store.v2'
│
├── lib/
│   ├── auth/store.ts        ← 用户 JSON 存储 data/users.json（含 role）
│   ├── auth/session.ts      ← Cookie Session（sv_session + SHA-256 token）
│   ├── valuation-schema.ts  ← STANDARD_FIELDS（37 个标准字段定义）
│   ├── fortune-template.ts  ← FortuneSheet 工作簿初始化
│   ├── template-engine.ts   ← Word 模板处理（mammoth, html-docx-js, html2pdf）
│   ├── report-template.ts   ← 默认报告 HTML 模板
│   ├── snapshot-store.ts    ← 报告快照（★ 内存 Map，服务重启即丢失）
│   ├── excel-utils.ts       ← FortuneSheet 单元格读取工具
│   └── auto-scanner.ts      ← 关键词自动匹配字段
│
├── components/
│   ├── excel/
│   │   ├── ValuationWorkbookPage.tsx  ← 通用工作簿页面（9 种方法复用）
│   │   ├── FieldManagerDrawer.tsx     ← 字段绑定侧边栏
│   │   └── AutoScanReviewDialog.tsx   ← 自动扫描结果确认
│   ├── auth/
│   │   ├── auth-hydration.tsx         ← Dashboard 认证水合
│   │   └── require-role.tsx           ← RBAC 前端守卫
│   ├── layout/
│   │   ├── sidebar.tsx                ← 导航（含角色可见性）
│   │   └── dashboard-layout.tsx       ← 主布局框架
│   └── valuation/
│       └── ValuationMethodTabs.tsx    ← 方法选项卡
│
├── app/
│   ├── (dashboard)/
│   │   ├── admin/
│   │   │   ├── page.tsx               ← System Admin 主页
│   │   │   ├── templates/page.tsx     ← 模板管理（Excel + Word）
│   │   │   └── users/page.tsx         ← 用户管理
│   │   ├── projects/
│   │   │   ├── page.tsx               ← 项目列表
│   │   │   ├── new/page.tsx           ← 新建项目
│   │   │   └── [id]/
│   │   │       ├── page.tsx           ← 项目详情
│   │   │       ├── basic-info/        ← 基础信息
│   │   │       ├── sales-comp/        ← 比较法（FortuneSheet）
│   │   │       ├── cost/              ← 成本法
│   │   │       ├── income/            ← 收益法
│   │   │       ├── hypothetical-dev/  ← 假设开发法
│   │   │       ├── benchmark-land-price/ ← 公示地价法
│   │   │       ├── residual-method/   ← 剩余法
│   │   │       ├── land-sales-comp/   ← 土地比较法
│   │   │       ├── land-income/       ← 收益还原法
│   │   │       ├── cost-approach-land/ ← 成本逼近法
│   │   │       ├── conclusion/        ← 估价结论
│   │   │       └── report/            ← 报告编辑器（Tiptap）
│   │   └── settings/                  ← 个人设置
│   ├── api/
│   │   ├── auth/                      ← 认证 API（login/register/me/logout）
│   │   ├── admin/
│   │   │   ├── reset-password/        ← 密码重置
│   │   │   └── users/                 ← 用户管理 API
│   │   ├── templates/sales-comp/      ← Excel 模板上传/状态
│   │   ├── projects/[id]/sales-comp/  ← 工作簿复制/下载/状态
│   │   └── reports/[snapshotId]/      ← 报告快照导出
│   └── middleware.ts                  ← Cookie 存在性检查（第一道防线）
│
├── data/                              ← 服务端文件存储
│   ├── users.json                     ← 用户数据（含 role）
│   ├── sessions.json                  ← Session 记录
│   ├── templates/                     ← Excel 模板文件
│   └── projects/                      ← 工作簿 JSON 快照（按 projectId_method.json）
```

### A.2 数据权威来源

| 数据类型 | 存储位置 | 持久化？ | 风险 |
|----------|----------|----------|------|
| 项目列表 & 项目数据 | `zustand store → localStorage` | ⚠️ 仅浏览器本地 | 清缓存即丢；5MB 上限 |
| 工作簿 sheet data | `zustand store.sheetData[method]` → localStorage | ⚠️ 同上 | 大表格轻松超限 |
| 报告 HTML | `project.reportContent` → localStorage | ⚠️ 同上 | |
| Word 模板（docxBase64） | `store.reportTemplates` → localStorage | ⚠️ 同上 | base64 膨胀 |
| Excel 模板文件 | `data/templates/*.xlsx` 文件系统 | ✅ 服务端 | 无版本控制 |
| 工作簿副本 | `data/projects/{id}_{method}.json` | ✅ 服务端 | 无租户隔离路径 |
| 用户 & Session | `data/users.json`, `data/sessions.json` | ✅ 服务端 | 无加密，无备份 |
| 报告快照 | `snapshot-store.ts` 内存 Map | ❌ 重启丢失 | |
| extractedMetrics | `project.extractedMetrics` → localStorage | ⚠️ 同上 | |

### A.3 现有管理入口

| 入口 | 路由 | 权限控制 |
|------|------|----------|
| System Admin 主页 | `/admin` | RequireRole(['admin','manager','reviewer']) |
| 模板管理 | `/admin/templates` | RequireRole + 上传按钮按角色 disable |
| 用户管理 | `/admin/users` | RequireRole(['admin','manager']) |
| Settings | `/settings` | 所有登录用户 |
| Excel 上传 API | `POST /api/templates/sales-comp/upload` | verifySession + role 校验 |
| Word 模板上传 | 前端 store action（无 API） | ⚠️ 仅前端校验 |

---

## Part B：缺失平台模块清单

### 1) 多租户 Tenant — ❌ 完全缺失 [P0]

| 检查项 | 当前状态 | 差距 |
|--------|----------|------|
| companyId / tenantId | **不存在** | `UserRecord` 无 `tenantId`，`Project` 无 `tenantId` |
| 项目隔离 | `projectsByUser[userId]` — 按用户隔离 | 同一公司多用户无法共享项目；不同公司无法隔离 |
| 模板隔离 | `reportTemplates` 全局数组 | 公司 A 上传的 Word 模板，公司 B 也能看到 |
| Excel 模板 | `data/templates/sales_comp_template.xlsx` 单文件 | 所有公司共用同一个 Excel 模板 |
| Store 泄露 | `localStorage` 同一域名所有用户共享 | 用户 A 退出、用户 B 登录时，可在 localStorage 看到 A 的数据 |
| API 泄露 | 工作簿 API (`/api/projects/[id]/sales-comp/*`) 无租户校验 | 知道 projectId 即可访问任意项目工作簿 |

**必须新增：**
```typescript
// UserRecord 新增
interface UserRecord {
    tenantId: string;  // ★ 新增
    role: UserRole;
    // ...
}

// Project 新增
interface Project {
    tenantId: string;  // ★ 新增
    // ...
}

// ReportTemplate 新增
interface ReportTemplate {
    tenantId: string;  // ★ 新增
    // ...
}
```

### 2) RBAC — ⚠️ 骨架已搭，缺后端闭环 [P1]

| 检查项 | 当前状态 | 差距 |
|--------|----------|------|
| 角色模型 | ✅ admin/manager/reviewer/valuer 已定义 | 基本够用 |
| 前端守卫 | ✅ `RequireRole` 组件 + `useCurrentUser` | 已实现 |
| 侧边栏可见性 | ✅ 按角色过滤 navItems | 已实现 |
| API 层校验 | ⚠️ 仅 Excel 上传和用户管理 API 有校验 | 工作簿 API、报告快照 API 无鉴权 |
| Word 上传 | ❌ 纯前端 store action，无 API | 绕过前端直接操作 localStorage 即可注入 |
| 权限矩阵 | ❌ 无集中定义 | 散落在各组件内 if/else |

**缺失 API 鉴权清单：**
- `POST /api/projects/[id]/sales-comp/copy-template` — 无鉴权
- `GET /api/projects/[id]/sales-comp/download` — 无鉴权
- `GET /api/projects/[id]/sales-comp/status` — 无鉴权
- `POST /api/projects/[id]/report/snapshot` — 无鉴权
- `GET /api/reports/[snapshotId]/export` — 无鉴权

### 3) 模板治理 — ⚠️ 入口已统一，缺生命周期 [P1]

| 检查项 | 当前状态 | 差距 |
|--------|----------|------|
| 统一入口 | ✅ `/admin/templates` 合并 Excel + Word | 已实现 |
| 版本管理 | ❌ 覆盖上传无历史 | 无法回滚 |
| 模板 → 项目复制 | ✅ Excel：`copy-template` API | 已实现 |
| Word 模板 → 项目 | ⚠️ 自动使用第一个模板，无显式选择 UI | `activeTemplate` 逻辑取 templates[0] |
| 多公司模板 | ❌ 全局共享 | 需 tenantId 隔离 |
| Word 模板存储 | ❌ base64 存 localStorage | 必须迁到服务端 |

### 4) 数据模型统一（估价方法引擎化）— ⚠️ 部分统一 [P1]

| 检查项 | 当前状态 | 差距 |
|--------|----------|------|
| 通用工作簿组件 | ✅ `ValuationWorkbookPage` 9 种方法复用 | 已实现 |
| sheetData 隔离 | ✅ `project.sheetData[method]` 按 method key | 已实现 |
| anchors/binding | ⚠️ 仅 `salesAnchors` 一个字段 | 所有方法共用同一个 anchors 字典，方法间可能冲突 |
| extractedMetrics | ⚠️ `Record<string, string|number|null>` 扁平 object | 无方法级分组，所有方法指标混在一起 |
| Legacy 数据 | ⚠️ `salesCompCases`, `costItems`, `salesResult` 仍在 Project | 增加复杂度，未清理 |
| report | 项目级 `reportContent` | 合理，一个项目一份报告 |

### 5) 保存/加载闭环 — ⚠️ 高风险 [P0]

| 场景 | 当前行为 | 问题 |
|------|----------|------|
| 项目数据保存 | `zustand persist → localStorage` | 5MB 限制；chrome 静默丢弃超限数据 |
| 工作簿保存 | `updateSheetData()` → store → localStorage | FortuneSheet 数据可达数 MB |
| 同时存在 `salesSheetData` 和 `sheetData['sales-comp']` | 是 | 双写，data 可能不一致 |
| 刷新恢复 | `ensureWorkbookData(storedData)` | 如果 storedData 为空/损坏，返回默认空白表 |
| 报告保存 | `saveReportContent()` → store → localStorage | 正常但受 localStorage 限制 |
| 报告快照 | `snapshot-store.ts` 内存 Map | 服务重启丢失所有快照 |
| Excel 工作簿副本 | `data/projects/{id}_{method}.json` 服务端文件 | ✅ 这是唯一可靠的持久化 |

**高风险场景：**
1. 用户编辑大型工作簿 → 数据超 localStorage 5MB → 新数据写入失败 → toast 显示"保存成功"但实际丢失
2. 用户 A 在设备 1 编辑 → 用户 A 在设备 2 打开 → 数据完全不同步

### 6) 审批与审计 — ❌ 完全缺失 [P2]

| 检查项 | 当前状态 |
|--------|----------|
| 操作日志 | 不存在 |
| 审批流 | 不存在 |
| 项目状态机 | 仅 `isDirty` 布尔值 |
| 导出记录 | `console.log` 仅服务端日志 |

---

## Part C：Phase 1 可交付方案

### 目标
```
✅ 多租户最小可用（tenantId 隔离）
✅ 保存可靠（从 localStorage 迁到服务端持久化）
✅ 模板治理入口统一且按公司隔离
✅ 报告可注入 metrics、可编辑、可导出
✅ RBAC 后端闭环
```

### C.1 必改数据结构

```typescript
// ===== 1. 新增 Tenant =====
interface Tenant {
    id: string;
    name: string;           // 公司名称
    createdAt: string;
}

// ===== 2. UserRecord 新增 tenantId =====
interface UserRecord {
    id: string;
    username: string;
    passwordHash: string;
    role: UserRole;
    tenantId: string;        // ★ 新增
    createdAt: string;
}

// ===== 3. Project 新增 tenantId =====
interface Project {
    id: string;
    tenantId: string;        // ★ 新增
    // ... 其余不变
}

// ===== 4. ReportTemplate 新增 tenantId =====
interface ReportTemplate {
    id: string;
    tenantId: string;        // ★ 新增
    // ... 其余不变，但 docxBase64 不再存 localStorage
}
```

### C.2 必改持久化架构

```
当前：
  浏览器 localStorage ← zustand persist ← 所有项目/模板数据
  
Phase 1 目标（最小改动）：
  服务端 data/ 目录 ← JSON 文件 ← 项目/模板数据
  ↓
  API 层 ← CRUD 接口
  ↓
  前端 ← React Query / SWR 缓存 ← UI

具体存储规划：
  data/
  ├── tenants.json                              ← 公司列表
  ├── users.json                                ← 用户（含 tenantId）
  ├── sessions.json                             ← Session
  ├── templates/
  │   ├── {tenantId}/
  │   │   ├── excel/sales_comp_template.xlsx     ← Excel 模板
  │   │   └── word/{templateId}.docx            ← Word 模板原文件
  └── projects/
      └── {tenantId}/
          ├── projects.json                      ← 该公司所有项目元数据
          └── {projectId}/
              ├── project.json                   ← 单项目完整数据
              └── sheets/
                  └── {method}.json              ← 工作簿数据
```

### C.3 必改路由与页面

| 当前 | 改动 | 说明 |
|------|------|------|
| `/admin/templates` | 增加 tenantId 过滤 | 仅显示本公司模板 |
| `/admin/users` | 增加 tenantId 过滤 | 仅显示本公司用户 |
| `/projects` | 从 API 加载 | 不再从 localStorage |
| 所有 `[id]/method` 页面 | 工作簿从 API 加载/保存 | 不再从 store |
| `/admin` 新增 | 公司信息管理 | 显示/编辑公司名称 |

### C.4 必加中间层

```typescript
// ===== 1. API 鉴权中间件 =====
// src/lib/api/with-auth.ts
export async function withAuth(
    request: NextRequest,
    allowedRoles?: UserRole[],
): Promise<{ user: SessionUser } | NextResponse> {
    const session = await verifySession();
    if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
    if (allowedRoles && !allowedRoles.includes(session.role)) {
        return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }
    return { user: session };
}

// ===== 2. 项目数据 Repository =====
// src/lib/repositories/project-repo.ts
export class ProjectRepository {
    static list(tenantId: string): Project[] { ... }
    static getById(tenantId: string, projectId: string): Project | null { ... }
    static save(tenantId: string, project: Project): void { ... }
    static delete(tenantId: string, projectId: string): void { ... }
}

// ===== 3. 模板 Repository =====
// src/lib/repositories/template-repo.ts
export class TemplateRepository {
    static listWord(tenantId: string): ReportTemplate[] { ... }
    static saveWordTemplate(tenantId: string, file: File): ReportTemplate { ... }
    static getExcelStatus(tenantId: string): TemplateStatus { ... }
    static uploadExcel(tenantId: string, file: File): void { ... }
}
```

### C.5 风险点与回滚方案

| 风险 | 影响 | 回滚方案 |
|------|------|----------|
| localStorage → API 迁移期间数据丢失 | 现有项目消失 | 迁移脚本：从 localStorage 导出 JSON → 导入到 data/ 目录 |
| API 响应慢导致 UX 退步 | 编辑卡顿 | 前端乐观更新 + 后台异步同步 |
| 多租户注册流程 | 谁创建公司？ | Phase 1 硬编码公司 + 管理员手动分配 tenantId |
| zustand store 改动大 | 全站影响 | 逐步迁移：先 API 化项目列表，再 API 化工作簿 |

---

## Part D：Phase 1 PR 计划（10 个 PR）

### PR 1：持久化基础设施 — 项目 Repository + API
**文件：**
- 新建 `src/lib/repositories/project-repo.ts`
- 新建 `src/app/api/projects/route.ts` （GET 列表、POST 创建）
- 新建 `src/app/api/projects/[id]/route.ts` （GET/PATCH/DELETE）
- 修改 `src/types/index.ts` — Project 新增 tenantId

**目标：** 项目 CRUD 通过 API 而非 localStorage
**验收：** API 返回正确 JSON；刷新后数据不丢失；不同浏览器访问相同账号看到相同项目

---

### PR 2：多租户数据模型 — Tenant + User.tenantId
**文件：**
- 新建 `data/tenants.json`
- 修改 `src/lib/auth/store.ts` — UserRecord 新增 tenantId
- 修改 `src/app/api/auth/register/route.ts` — 注册时分配 tenantId
- 修改 `src/app/api/auth/me/route.ts` — 返回 tenantId
- 修改 `src/lib/auth/session.ts` — verifySession 返回 tenantId

**目标：** 每个用户有 tenantId，API 层可获取
**验收：** `/api/auth/me` 返回 `{ userId, username, role, tenantId }`

---

### PR 3：项目 API 接入前端 — 替换 localStorage 项目列表
**文件：**
- 修改 `src/store/index.ts` — 移除 projectsByUser persist，改为 API 驱动
- 修改 `src/app/(dashboard)/projects/page.tsx` — 从 API fetch
- 修改 `src/app/(dashboard)/projects/new/page.tsx` — POST 创建
- 修改 `src/components/auth/auth-hydration.tsx`

**目标：** 项目列表和项目创建/删除走 API
**验收：** 两个浏览器登录同一账号，一个创建项目，另一个刷新能看到；清 localStorage 项目不丢

---

### PR 4：工作簿持久化 API
**文件：**
- 新建 `src/app/api/projects/[id]/sheets/[method]/route.ts` （GET/PUT）
- 新建 `src/lib/repositories/sheet-repo.ts`
- 修改 `src/components/excel/ValuationWorkbookPage.tsx` — 保存走 API

**目标：** FortuneSheet 数据通过 API 保存到 `data/projects/{tenantId}/{projectId}/sheets/{method}.json`
**验收：** 编辑工作簿 → 刷新 → 数据完整；清 localStorage → 刷新 → 数据仍在

---

### PR 5：模板持久化 — Word 模板迁到服务端
**文件：**
- 新建 `src/app/api/templates/word/route.ts` （GET 列表、POST 上传）
- 新建 `src/app/api/templates/word/[id]/route.ts` （DELETE）
- 新建 `src/lib/repositories/template-repo.ts`
- 修改 `src/app/(dashboard)/admin/templates/page.tsx` — 从 API 操作
- 修改 `src/store/index.ts` — 移除 reportTemplates 的 localStorage persist
- 修改 `data/templates/` — 按 tenantId 分目录

**目标：** Word 模板文件存服务端，不再 base64 塞 localStorage
**验收：** 上传 5MB docx → 成功；localStorage 大小不增长；不同设备可见

---

### PR 6：租户隔离 — 所有读写绑定 tenantId
**文件：**
- 修改所有 API route — 读写操作绑定 session.tenantId
- 修改 `src/app/api/templates/sales-comp/upload/route.ts` — 按 tenantId 存储
- 修改 `src/app/api/admin/users/route.ts` — 仅返回同公司用户

**目标：** 公司隔离
**验收：** 同一浏览器登录公司 A 用户 → 看到 A 的项目/模板；切换登录公司 B 用户 → 看到 B 的，A 的完全不可见

---

### PR 7：API 统一鉴权中间件
**文件：**
- 新建 `src/lib/api/with-auth.ts`
- 修改所有 API route 使用统一鉴权
- 修改 `src/middleware.ts` — `/admin` 路径加入保护列表

**目标：** 所有 API 都有鉴权 + 角色校验
**验收：** 未登录调用任意项目 API → 401；valuer 调用上传 API → 403

---

### PR 8：报告快照持久化
**文件：**
- 修改 `src/lib/snapshot-store.ts` — 改为文件存储
- 修改 `src/app/api/projects/[id]/report/snapshot/route.ts`
- 修改 `src/app/api/reports/[snapshotId]/export/route.ts`

**目标：** 报告快照持久化到文件，服务重启不丢
**验收：** 创建快照 → 重启 dev server → 快照仍可导出

---

### PR 9：审计日志（最小版）
**文件：**
- 新建 `src/lib/repositories/audit-log.ts`
- 新建 `data/audit-logs/`
- 修改关键 API — 记录操作日志（模板上传、角色修改、项目创建/删除、报告导出）

**目标：** 关键操作有日志可追溯
**验收：** 管理员上传模板 → `data/audit-logs/` 出现记录；记录含 userId/tenantId/action/timestamp

---

### PR 10：前端清理 + 迁移工具
**文件：**
- 新建 `src/app/api/admin/migrate/route.ts` — 从 localStorage 导入旧数据
- 修改 `src/store/index.ts` — 清理不再需要的 persist 字段
- 修改 `src/types/index.ts` — 清理 Legacy 类型（salesCompCases 等标记 @deprecated）

**目标：** 平滑迁移 + 代码清理
**验收：** 现有用户可一键导入 localStorage 旧数据到新 API 持久化层；导入后所有项目/模板完整

---

## 附录：权限矩阵（Phase 1 完整版）

| 功能 | admin | manager | reviewer | valuer |
|------|:-----:|:-------:|:--------:|:------:|
| System Admin 可见 | ✅ | ✅ | ✅(只读) | ❌ |
| 上传 Excel/Word 模板 | ✅ | ✅ | ❌ | ❌ |
| 管理用户角色 | ✅ | ❌ | ❌ | ❌ |
| 查看用户列表 | ✅ | ✅ | ❌ | ❌ |
| 创建/编辑项目 | ✅ | ✅ | ✅ | ✅ |
| 删除项目 | ✅ | ✅ | ❌ | ❌ |
| 编辑工作簿 | ✅ | ✅ | ✅ | ✅ |
| 绑定/提取字段 | ✅ | ✅ | ✅ | ✅ |
| 编辑报告 | ✅ | ✅ | ✅ | ✅ |
| 导出 Word/PDF | ✅ | ✅ | ✅ | ✅ |
| 查看审计日志 | ✅ | ✅ | ❌ | ❌ |
| 重置用户密码 | ✅ | ❌ | ❌ | ❌ |
