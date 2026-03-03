import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { ApiResponse, canPerformAction, SpendSummary, VendorSummary, MonthlySummary, ReportFilters } from '@/types';
import { DocumentStatus, DocumentType } from '@prisma/client';

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<SpendSummary>>> {
  try {
    const user = await getCurrentUser();
    
    if (!user || !canPerformAction(user.role, 'export_reports')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    
    // Parse filters
    const filters: ReportFilters = {
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      vendorName: searchParams.get('vendorName') || undefined,
      status: searchParams.get('status')?.split(',') as DocumentStatus[] | undefined,
      documentType: searchParams.get('documentType')?.split(',') as DocumentType[] | undefined,
      minAmount: searchParams.get('minAmount') ? parseFloat(searchParams.get('minAmount')!) : undefined,
      maxAmount: searchParams.get('maxAmount') ? parseFloat(searchParams.get('maxAmount')!) : undefined,
    };
    
    // Build where clause - ONLY include APPROVED documents for financial reports
    const where: Record<string, unknown> = {
      status: DocumentStatus.APPROVED, // Only approved documents in reports
    };
    
    // Override status filter - we still only allow viewing approved docs in reports
    // but can filter by document type
    if (filters.documentType && filters.documentType.length > 0) {
      where.type = { in: filters.documentType };
    }
    
    if (filters.vendorName) {
      where.vendorName = { contains: filters.vendorName, mode: 'insensitive' };
    }
    
    if (filters.startDate || filters.endDate) {
      where.documentDate = {};
      if (filters.startDate) {
        (where.documentDate as Record<string, unknown>).gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        (where.documentDate as Record<string, unknown>).lte = new Date(filters.endDate);
      }
    }
    
    if (filters.minAmount || filters.maxAmount) {
      where.totalAmount = {};
      if (filters.minAmount) {
        (where.totalAmount as Record<string, unknown>).gte = filters.minAmount;
      }
      if (filters.maxAmount) {
        (where.totalAmount as Record<string, unknown>).lte = filters.maxAmount;
      }
    }
    
    // Get all matching APPROVED documents for financial reporting
    const documents = await db.document.findMany({
      where,
      select: {
        id: true,
        vendorName: true,
        totalAmount: true,
        vatAmount: true,
        amount: true,
        status: true,
        documentDate: true,
        createdAt: true,
      },
    });
    
    // Also get counts for all documents (for dashboard stats)
    const allDocuments = await db.document.findMany({
      select: {
        status: true,
      },
    });
    
    // Calculate summary statistics - ONLY from approved documents
    const totalAmount = documents.reduce((sum, doc) => sum + (doc.totalAmount || 0), 0);
    const totalVat = documents.reduce((sum, doc) => sum + (doc.vatAmount || 0), 0);
    const totalDocuments = documents.length;
    
    // Count all statuses from all documents
    const pendingStatuses: DocumentStatus[] = [DocumentStatus.PENDING_REVIEWER, DocumentStatus.PENDING_MANAGER, DocumentStatus.PENDING_FINANCE];
    
    const approvedCount = allDocuments.filter(d => d.status === DocumentStatus.APPROVED).length;
    const rejectedCount = allDocuments.filter(d => d.status === DocumentStatus.REJECTED).length;
    const pendingCount = allDocuments.filter(d => pendingStatuses.includes(d.status)).length;
    const draftCount = allDocuments.filter(d => d.status === DocumentStatus.DRAFT).length;
    
    // Group by vendor - only approved documents
    const vendorMap = new Map<string, { total: number; count: number; approved: number; pending: number }>();
    
    documents.forEach(doc => {
      if (doc.vendorName) {
        const existing = vendorMap.get(doc.vendorName) || { total: 0, count: 0, approved: 0, pending: 0 };
        existing.total += doc.totalAmount || 0;
        existing.count += 1;
        existing.approved += 1; // All docs in report are approved
        vendorMap.set(doc.vendorName, existing);
      }
    });
    
    const byVendor: VendorSummary[] = Array.from(vendorMap.entries())
      .map(([vendorName, data]) => ({
        vendorName,
        totalAmount: data.total,
        documentCount: data.count,
        approvedCount: data.approved,
        pendingCount: 0, // All shown are approved
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 20);
    
    // Group by month - only approved documents
    const monthMap = new Map<string, { total: number; count: number }>();
    
    documents.forEach(doc => {
      const date = doc.documentDate || doc.createdAt;
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const existing = monthMap.get(monthKey) || { total: 0, count: 0 };
      existing.total += doc.totalAmount || 0;
      existing.count += 1;
      monthMap.set(monthKey, existing);
    });
    
    const byMonth: MonthlySummary[] = Array.from(monthMap.entries())
      .map(([month, data]) => ({
        month,
        totalAmount: data.total,
        documentCount: data.count,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
    
    const summary: SpendSummary = {
      totalAmount,
      totalVat,
      totalDocuments,
      approvedCount,
      rejectedCount,
      pendingCount,
      draftCount,
      byVendor,
      byMonth,
    };
    
    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('Report error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
