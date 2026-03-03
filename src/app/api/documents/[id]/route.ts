import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { ApiResponse, DocumentWithUploader, canPerformAction } from '@/types';
import { unlink } from 'fs/promises';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<{ document: DocumentWithUploader }>>> {
  try {
    const user = await getCurrentUser();
    
    if (!user || !canPerformAction(user.role, 'view')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }
    
    const { id } = await params;
    
    const document = await db.document.findUnique({
      where: { id },
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
        approvals: {
          include: {
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
          orderBy: { step: 'asc' },
        },
      },
    });
    
    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      document: document as DocumentWithUploader,
    });
  } catch (error) {
    console.error('Get document error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch document' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<{ document: DocumentWithUploader }>>> {
  try {
    const user = await getCurrentUser();
    
    if (!user || !canPerformAction(user.role, 'upload')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }
    
    const { id } = await params;
    const body = await request.json();
    
    // Check if document exists
    const existingDoc = await db.document.findUnique({
      where: { id },
    });
    
    if (!existingDoc) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }
    
    // Only allow editing if document is in DRAFT status or user is ADMIN
    if (existingDoc.status !== 'DRAFT' && user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Can only edit documents in DRAFT status' },
        { status: 400 }
      );
    }
    
    // Update document
    const document = await db.document.update({
      where: { id },
      data: {
        invoiceNumber: body.invoiceNumber ?? existingDoc.invoiceNumber,
        vendorName: body.vendorName ?? existingDoc.vendorName,
        vendorAddress: body.vendorAddress ?? existingDoc.vendorAddress,
        documentDate: body.documentDate ? new Date(body.documentDate) : existingDoc.documentDate,
        dueDate: body.dueDate ? new Date(body.dueDate) : existingDoc.dueDate,
        amount: body.amount !== undefined ? body.amount : existingDoc.amount,
        vatAmount: body.vatAmount !== undefined ? body.vatAmount : existingDoc.vatAmount,
        totalAmount: body.totalAmount !== undefined ? body.totalAmount : existingDoc.totalAmount,
        currency: body.currency ?? existingDoc.currency,
        description: body.description ?? existingDoc.description,
      },
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
        approvals: true,
      },
    });
    
    // Create audit log
    await db.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE_DOCUMENT',
        entityType: 'DOCUMENT',
        entityId: id,
        details: `Updated document: ${existingDoc.fileName}`,
      },
    });
    
    return NextResponse.json({
      success: true,
      document: document as DocumentWithUploader,
    });
  } catch (error) {
    console.error('Update document error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update document' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<null>>> {
  try {
    const user = await getCurrentUser();
    
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Admin only' },
        { status: 403 }
      );
    }
    
    const { id } = await params;
    
    // Check if document exists
    const existingDoc = await db.document.findUnique({
      where: { id },
    });
    
    if (!existingDoc) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }
    
    // Delete file from disk
    try {
      const uploadsDir = path.join(process.cwd(), 'uploads');
      const filePath = path.join(uploadsDir, existingDoc.filePath);
      await unlink(filePath);
    } catch (fileError) {
      console.error('Error deleting file:', fileError);
      // Continue even if file deletion fails
    }
    
    // Delete approvals first (due to foreign key constraints)
    await db.approval.deleteMany({
      where: { documentId: id },
    });
    
    // Delete document
    await db.document.delete({
      where: { id },
    });
    
    // Create audit log
    await db.auditLog.create({
      data: {
        userId: user.id,
        action: 'DELETE_DOCUMENT',
        entityType: 'DOCUMENT',
        entityId: id,
        details: `Deleted document: ${existingDoc.fileName}`,
      },
    });
    
    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Delete document error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}
