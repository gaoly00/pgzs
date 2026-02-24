/**
 * 项目 API
 * GET  /api/projects — 获取当前租户的项目列表
 * POST /api/projects — 创建新项目
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth/session';
import { v4 as uuidv4 } from 'uuid';
import {
    listProjects,
    createProject,
    type ServerProject,
} from '@/lib/repositories/project-repo';

/** GET — 获取项目列表 */
export async function GET() {
    try {
        const session = await verifySession();
        if (!session) {
            return NextResponse.json({ error: '未登录' }, { status: 401 });
        }

        const projects = listProjects(session.tenantId);
        return NextResponse.json({ projects });
    } catch (error) {
        console.error('[projects GET] 错误:', error);
        return NextResponse.json({ error: '获取项目列表失败' }, { status: 500 });
    }
}

/** POST — 创建新项目 */
export async function POST(request: NextRequest) {
    try {
        const session = await verifySession();
        if (!session) {
            return NextResponse.json({ error: '未登录' }, { status: 401 });
        }

        const body = await request.json();
        const { name, projectNumber, projectType, valuationDate, propertyType, gfa, address, valuationMethods } = body;

        if (!name || typeof name !== 'string' || !name.trim()) {
            return NextResponse.json({ error: '项目名称不能为空' }, { status: 400 });
        }

        const now = new Date().toISOString();
        const project: ServerProject = {
            id: uuidv4(),
            tenantId: session.tenantId,
            name: name.trim(),
            projectNumber: projectNumber || '',
            projectType: projectType || 'real-estate',
            valuationDate: valuationDate || '',
            propertyType: propertyType || '',
            gfa: gfa ?? null,
            address: address || '',
            valuationMethods: valuationMethods || ['sales-comp'],
            salesAnchors: {},
            salesResult: { unitPrice: null, totalValue: null },
            extractedMetrics: {},
            customFields: [],
            status: {
                isDirty: false,
                reportGeneratedAt: null,
            },
            createdBy: session.userId,
            createdAt: now,
            updatedAt: now,
        };

        createProject(session.tenantId, project);

        console.log(`[projects] 创建: ${project.name} (${project.id}), 租户: ${session.tenantId}, 用户: ${session.username}`);

        return NextResponse.json({ ok: true, project }, { status: 201 });
    } catch (error) {
        console.error('[projects POST] 错误:', error);
        return NextResponse.json({ error: '创建项目失败' }, { status: 500 });
    }
}
