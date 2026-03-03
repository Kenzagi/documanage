import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { ApiResponse, canPerformAction } from '@/types';
import { ApprovalStep, DocumentStatus } from '@prisma/client';

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    const user = await getCurrentUser();
    
    if (!user || !canPerformAction(user.role, 'upload')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    const { documentId } = body;
    
    if (!documentId) {
      return NextResponse.json(
        { success: false, error: 'Document ID is required' },
        { status: 400 }
      );
    }
    
    // Get the document
    const document = await db.document.findUnique({
      where: { id: documentId },
    });
    
    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }
    
    // Check if user owns the document or is admin
    if (document.uploaderId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'You can only submit your own documents' },
        { status: 403 }
      );
    }
    
    // Check if document is in DRAFT status
    if (document.status !== DocumentStatus.DRAFT) {
      return NextResponse.json(
        { success: false, error: 'Document must be in DRAFT status to submit for approval' },
        { status: 400 }
      );
    }
    
    // Update document status
    await db.document.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.PENDING_REVIEWER,
        currentStep: 1,
      },
    });
    
    // Create approval records for each step (approverId will be set when someone acts on it)
    await db.approval.createMany({
      data: [
        { documentId, step: ApprovalStep.STEP_1_REVIEWER },
        { documentId, step: ApprovalStep.STEP_2_MANAGER },
        { documentId, step: ApprovalStep.STEP_3_FINANCE },
      ],
    });
    
    // Create audit log
    await db.auditLog.create({
      data: {
        userId: user.id,
        action: 'SUBMIT_FOR_APPROVAL',
        entityType: 'DOCUMENT',
        entityId: documentId,
        details: 'Document submitted for approval workflow',
      },
    });
    
    return NextResponse.json({
      success: true,
      message: 'Document submitted for approval successfully',
    });
  } catch (error) {
    console.error('Submit for approval error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to submit document for approval' },
      { status: 500 }
    );
  }
}
