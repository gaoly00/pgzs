This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## 工作流编排 (Workflow Orchestration)

### 1. 默认开启计划模式 (Plan Node Default)
- 针对任何非琐碎任务（3步以上或涉及架构决策），必须进入计划模式。
- 如果执行过程中出现偏差，立即停止并重新规划——不要盲目推进。
- 计划模式不仅用于构建，也应涵盖验证步骤。
- 预先编写详细规范，以减少歧义。

### 2. 子代理策略 (Subagent Strategy)
- 大胆使用子代理，以保持主上下文窗口的整洁。
- 将调研、探索和并行分析任务下放给子代理。
- 面对复杂问题，通过子代理投入更多算力。
- 每个子代理只负责一个任务，确保执行专注。

### 3. 自我进化循环 (Self-Improvement Loop)
- 在用户进行任何纠正后：在 `tasks/lessons.md` 中更新该模式/教训。
- 为自己编写规则，防止重复犯错。
- 严格迭代这些教训，直到错误率下降。
- 在每个项目会话开始时，审阅相关的教训记录。

### 4. 完成前验证 (Verification Before Done)
- 在证明方案有效之前，严禁将任务标记为已完成。
- 必要时，对比主分支与你修改后的行为差异。
- 问自己：“资深工程师（Staff Engineer）会批准这个改动吗？”
- 运行测试、检查日志，并演示其正确性。

### 5. 追求优雅（平衡取舍）(Demand Elegance)
- 对于非琐碎的改动：停下来思考“是否有更优雅的实现方式？”
- 如果修复方式感觉很“脏”（Hacky）：基于现有认知，重新实现更优雅的方案。
- 简单的修复则跳过此步——避免过度设计。
- 在展示成果前，先自我挑战/审视工作。

### 6. 自主 Bug 修复 (Autonomous Bug Fixing)
- 收到 Bug 报告后：直接修复，不要请求“手把手”指导。
- 定位日志、错误、失败的测试——然后解决它们。
- 尽量做到让用户零上下文切换（不打扰用户）。
- 自主修复失败的 CI 测试，无需指令。

## 任务管理 (Task Management)

1. **计划先行**：在 `tasks/todo.md` 中编写带有复选框的任务清单。
2. **验证计划**：在开始实施前，先与用户确认方案。
3. **跟踪进度**：随时标记已完成的项目。
4. **解释变更**：在每一步提供高层级的逻辑摘要。
5. **记录结果**：在 `tasks/todo.md` 中添加评审（Review）章节。
6. **沉淀教训**：被纠错后，及时更新 `tasks/lessons.md`。

## 核心原则 (Core Principles)

- **简洁至上**：让每一次改动尽可能简单。对代码的影响降到最低。
- **拒绝懒惰**：挖掘根本原因。杜绝临时补丁。坚持高级开发人员的标准。
- **最小化影响**：改动应仅限于必要部分。严防引入新 Bug。