import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { ApiResponse, DocumentWithUploader, canPerformAction, ReportFilters } from '@/types';
import { DocumentStatus, DocumentType } from '@prisma/client';

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<{ documents: DocumentWithUploader[]; total: number }>>> {
  try {
    const user = await getCurrentUser();
    
    if (!user || !canPerformAction(user.role, 'view')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    
    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;
    
    // Filters
    const status = searchParams.get('status')?.split(',') as DocumentStatus[] | null;
    const documentType = searchParams.get('documentType')?.split(',') as DocumentType[] | null;
    const vendorName = searchParams.get('vendorName');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const minAmount = searchParams.get('minAmount');
    const maxAmount = searchParams.get('maxAmount');
    const search = searchParams.get('search');
    
    // Build where clause
    const where: Record<string, unknown> = {};
    
    if (status && status.length > 0) {
      where.status = { in: status };
    }
    
    if (documentType && documentType.length > 0) {
      where.type = { in: documentType };
    }
    
    if (vendorName) {
      where.vendorName = { contains: vendorName, mode: 'insensitive' };
    }
    
    if (startDate || endDate) {
      where.documentDate = {};
      if (startDate) {
        (where.documentDate as Record<string, unknown>).gte = new Date(startDate);
      }
      if (endDate) {
        (where.documentDate as Record<string, unknown>).lte = new Date(endDate);
      }
    }
    
    if (minAmount || maxAmount) {
      where.totalAmount = {};
      if (minAmount) {
        (where.totalAmount as Record<string, unknown>).gte = parseFloat(minAmount);
      }
      if (maxAmount) {
        (where.totalAmount as Record<string, unknown>).lte = parseFloat(maxAmount);
      }
    }
    
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { vendorName: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    // Get documents
    const [documents, total] = await Promise.all([
      db.document.findMany({
        where,
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
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.document.count({ where }),
    ]);
    
    return NextResponse.json({
      success: true,
      documents: documents as DocumentWithUploader[],
      total,
    });
  } catch (error) {
    console.error('Get documents error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    const user = await getCurrentUser();
    
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Document ID is required' },
        { status: 400 }
      );
    }
    
    // Delete associated approvals first
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
        details: 'Document deleted',
      },
    });
    
    return NextResponse.json({ success: true, message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete document error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}
