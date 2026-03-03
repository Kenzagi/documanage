import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { ApiResponse, canPerformAction, getApprovalStepForRole, getRequiredRoleForStep, PendingApprovalsResponse } from '@/types';
import { ApprovalAction, ApprovalStep, DocumentStatus } from '@prisma/client';

// Get pending approvals for current user
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<PendingApprovalsResponse>>> {
  try {
    const user = await getCurrentUser();
    
    if (!user || !canPerformAction(user.role, 'view')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }
    
    // Get the approval step for this user's role
    const userStep = getApprovalStepForRole(user.role);
    
    // Build where clause based on user role
    let where: Record<string, unknown> = {};
    
    if (userStep) {
      // User is an approver - show pending approvals for their step
      where = {
        step: userStep,
        action: null, // Not yet acted upon
        document: {
          status: getDocumentStatusForStep(userStep),
        },
      };
    } else if (user.role === 'ADMIN') {
      // Admins can see all pending approvals
      where = {
        action: null,
      };
    } else {
      // Non-approvers don't see pending approvals
      return NextResponse.json({
        success: true,
        approvals: [],
        total: 0,
      });
    }
    
    const approvals = await db.approval.findMany({
      where,
      include: {
        document: {
          include: {
            uploader: {
              select: {
                id: true,
                email: true,
                name: true,
                role: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        },
        approver: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    return NextResponse.json({
      success: true,
      approvals: approvals as PendingApprovalsResponse['approvals'],
      total: approvals.length,
    });
  } catch (error) {
    console.error('Get pending approvals error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch pending approvals' },
      { status: 500 }
    );
  }
}

// Submit approval decision
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    const { documentId, action, comment } = body as {
      documentId: string;
      action: ApprovalAction;
      comment?: string;
    };
    
    if (!documentId || !action) {
      return NextResponse.json(
        { success: false, error: 'Document ID and action are required' },
        { status: 400 }
      );
    }
    
    // Get the document
    const document = await db.document.findUnique({
      where: { id: documentId },
      include: { approvals: true },
    });
    
    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }
    
    // Determine required step based on document status
    const requiredStep = getApprovalStepForDocumentStatus(document.status);
    const userStep = getApprovalStepForRole(user.role);
    
    // Verify user can approve at this step
    if (user.role !== 'ADMIN' && userStep !== requiredStep) {
      return NextResponse.json(
        { success: false, error: 'You are not authorized to approve at this stage' },
        { status: 403 }
      );
    }
    
    // Check if already approved at this step
    const existingApproval = await db.approval.findUnique({
      where: {
        documentId_step: {
          documentId,
          step: requiredStep,
        },
      },
    });
    
    if (existingApproval?.action) {
      return NextResponse.json(
        { success: false, error: 'This step has already been completed' },
        { status: 400 }
      );
    }
    
    // Create or update approval
    const approval = await db.approval.upsert({
      where: {
        documentId_step: {
          documentId,
          step: requiredStep,
        },
      },
      create: {
        documentId,
        approverId: user.id,
        step: requiredStep,
        action,
        comment,
        actedAt: new Date(),
      },
      update: {
        approverId: user.id,
        action,
        comment,
        actedAt: new Date(),
      },
    });
    
    // Update document status
    let newStatus: DocumentStatus;
    let newStep = document.currentStep;
    
    if (action === 'REJECTED') {
      newStatus = DocumentStatus.REJECTED;
    } else if (requiredStep === ApprovalStep.STEP_3_FINANCE) {
      // Final approval
      newStatus = DocumentStatus.APPROVED;
    } else {
      // Move to next step
      newStep = document.currentStep + 1;
      newStatus = getNextStatus(requiredStep);
    }
    
    await db.document.update({
      where: { id: documentId },
      data: {
        status: newStatus,
        currentStep: newStep,
        approvedAt: newStatus === DocumentStatus.APPROVED ? new Date() : null,
        rejectedAt: newStatus === DocumentStatus.REJECTED ? new Date() : null,
      },
    });
    
    // Create audit log
    await db.auditLog.create({
      data: {
        userId: user.id,
        action: action === 'APPROVED' ? 'APPROVE_DOCUMENT' : 'REJECT_DOCUMENT',
        entityType: 'DOCUMENT',
        entityId: documentId,
        details: `${action} at step ${requiredStep}. Comment: ${comment || 'N/A'}`,
      },
    });
    
    return NextResponse.json({
      success: true,
      message: `Document ${action.toLowerCase()} successfully`,
    });
  } catch (error) {
    console.error('Approval error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process approval' },
      { status: 500 }
    );
  }
}

function getDocumentStatusForStep(step: ApprovalStep): DocumentStatus {
  switch (step) {
    case ApprovalStep.STEP_1_REVIEWER:
      return DocumentStatus.PENDING_REVIEWER;
    case ApprovalStep.STEP_2_MANAGER:
      return DocumentStatus.PENDING_MANAGER;
    case ApprovalStep.STEP_3_FINANCE:
      return DocumentStatus.PENDING_FINANCE;
    default:
      return DocumentStatus.DRAFT;
  }
}

function getApprovalStepForDocumentStatus(status: DocumentStatus): ApprovalStep {
  switch (status) {
    case DocumentStatus.PENDING_REVIEWER:
      return ApprovalStep.STEP_1_REVIEWER;
    case DocumentStatus.PENDING_MANAGER:
      return ApprovalStep.STEP_2_MANAGER;
    case DocumentStatus.PENDING_FINANCE:
      return ApprovalStep.STEP_3_FINANCE;
    default:
      return ApprovalStep.STEP_1_REVIEWER;
  }
}

function getNextStatus(currentStep: ApprovalStep): DocumentStatus {
  switch (currentStep) {
    case ApprovalStep.STEP_1_REVIEWER:
      return DocumentStatus.PENDING_MANAGER;
    case ApprovalStep.STEP_2_MANAGER:
      return DocumentStatus.PENDING_FINANCE;
    default:
      return DocumentStatus.APPROVED;
  }
}
