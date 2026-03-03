import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { ApiResponse, canPerformAction, AIInsight, InsightsResponse } from '@/types';
import { DocumentStatus, DocumentType } from '@prisma/client';
import ZAI from 'z-ai-web-dev-sdk';

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<InsightsResponse>>> {
  try {
    const user = await getCurrentUser();
    
    if (!user || !canPerformAction(user.role, 'view_insights')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Insufficient seniority' },
        { status: 403 }
      );
    }
    
    // Get ONLY APPROVED documents for financial analysis
    // Pending documents should NOT be included in reports and analysis
    const documents = await db.document.findMany({
      where: {
        status: DocumentStatus.APPROVED, // Only approved documents for analysis
      },
      select: {
        id: true,
        type: true,
        vendorName: true,
        totalAmount: true,
        vatAmount: true,
        amount: true,
        status: true,
        documentDate: true,
        createdAt: true,
        invoiceNumber: true,
        isDuplicate: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    
    // Also get all documents for status counts (but not for financial analysis)
    const allDocuments = await db.document.findMany({
      select: {
        status: true,
        createdAt: true,
      },
    });
    
    // Define pending statuses for filtering
    const pendingStatuses: DocumentStatus[] = [DocumentStatus.PENDING_REVIEWER, DocumentStatus.PENDING_MANAGER, DocumentStatus.PENDING_FINANCE];
    
    // Calculate basic statistics from APPROVED documents only
    const totalAmount = documents.reduce((sum, doc) => sum + (doc.totalAmount || 0), 0);
    const avgAmount = totalAmount / documents.length || 0;
    
    // Group by vendor (approved only)
    const vendorMap = new Map<string, { total: number; count: number; amounts: number[] }>();
    documents.forEach(doc => {
      if (doc.vendorName) {
        const existing = vendorMap.get(doc.vendorName) || { total: 0, count: 0, amounts: [] };
        existing.total += doc.totalAmount || 0;
        existing.count += 1;
        existing.amounts.push(doc.totalAmount || 0);
        vendorMap.set(doc.vendorName, existing);
      }
    });
    
    // Top vendors (approved only)
    const topVendors = Array.from(vendorMap.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5);
    
    // Find anomalies (amounts significantly different from average) - approved only
    const anomalies = documents.filter(doc => {
      if (!doc.totalAmount) return false;
      const deviation = Math.abs(doc.totalAmount - avgAmount) / avgAmount;
      return deviation > 2; // More than 200% deviation
    });
    
    // Pending approvals stuck for more than 3 days (from all documents)
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const stuckApprovals = allDocuments.filter(doc => 
      pendingStatuses.includes(doc.status as DocumentStatus) &&
      doc.createdAt < threeDaysAgo
    );
    
    // Duplicate count (approved only)
    const duplicateCount = documents.filter(doc => doc.isDuplicate).length;
    
    // Monthly trend (approved only)
    const monthMap = new Map<string, number>();
    documents.forEach(doc => {
      const date = doc.documentDate || doc.createdAt;
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + (doc.totalAmount || 0));
    });
    
    const monthlyTrend = Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6);
    
    // Generate AI insights
    const insights = await generateAIInsights({
      totalDocuments: documents.length,
      totalAmount,
      avgAmount,
      topVendors,
      anomalies: anomalies.slice(0, 5),
      stuckApprovals: stuckApprovals.length,
      duplicateCount,
      monthlyTrend,
      approvalStats: {
        approved: allDocuments.filter(d => d.status === DocumentStatus.APPROVED).length,
        rejected: allDocuments.filter(d => d.status === DocumentStatus.REJECTED).length,
        pending: allDocuments.filter(d => pendingStatuses.includes(d.status as DocumentStatus)).length,
      },
    });
    
    return NextResponse.json({
      success: true,
      data: {
        insights,
        generatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Insights error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate insights' },
      { status: 500 }
    );
  }
}

async function generateAIInsights(data: {
  totalDocuments: number;
  totalAmount: number;
  avgAmount: number;
  topVendors: [string, { total: number; count: number; amounts: number[] }][];
  anomalies: { id: string; vendorName: string | null; totalAmount: number | null }[];
  stuckApprovals: number;
  duplicateCount: number;
  monthlyTrend: [string, number][];
  approvalStats: { approved: number; rejected: number; pending: number };
}): Promise<AIInsight[]> {
  const insights: AIInsight[] = [];
  
  // Rule-based insights (fast and reliable)
  
  // Spending concentration insight
  if (data.topVendors.length > 0) {
    const topVendorShare = (data.topVendors[0][1].total / data.totalAmount) * 100;
    if (topVendorShare > 30) {
      insights.push({
        type: 'warning',
        title: 'High Vendor Concentration',
        description: `${data.topVendors[0][0]} accounts for ${topVendorShare.toFixed(1)}% of total spending (${formatCurrency(data.topVendors[0][1].total)}). Consider diversifying suppliers to reduce dependency risk.`,
        severity: topVendorShare > 50 ? 'high' : 'medium',
        data: { vendor: data.topVendors[0][0], percentage: topVendorShare },
      });
    }
  }
  
  // Stuck approvals warning
  if (data.stuckApprovals > 0) {
    insights.push({
      type: 'warning',
      title: 'Delayed Approvals',
      description: `${data.stuckApprovals} document${data.stuckApprovals > 1 ? 's have' : ' has'} been pending approval for more than 3 days. Consider following up to prevent payment delays.`,
      severity: data.stuckApprovals > 5 ? 'high' : 'medium',
      data: { count: data.stuckApprovals },
    });
  }
  
  // Duplicate documents warning
  if (data.duplicateCount > 0) {
    insights.push({
      type: 'anomaly',
      title: 'Potential Duplicate Documents',
      description: `${data.duplicateCount} potential duplicate document${data.duplicateCount > 1 ? 's' : ''} detected. Review these to prevent duplicate payments.`,
      severity: 'high',
      data: { count: data.duplicateCount },
    });
  }
  
  // Spending trend insight
  if (data.monthlyTrend.length >= 2) {
    const lastTwoMonths = data.monthlyTrend.slice(-2);
    const change = ((lastTwoMonths[1][1] - lastTwoMonths[0][1]) / lastTwoMonths[0][1]) * 100;
    if (Math.abs(change) > 20) {
      insights.push({
        type: 'trend',
        title: change > 0 ? 'Spending Increase Detected' : 'Spending Decrease Detected',
        description: `Monthly spending ${change > 0 ? 'increased' : 'decreased'} by ${Math.abs(change).toFixed(1)}% compared to the previous month. Current: ${formatCurrency(lastTwoMonths[1][1])}, Previous: ${formatCurrency(lastTwoMonths[0][1])}.`,
        severity: Math.abs(change) > 50 ? 'high' : 'medium',
        data: { change, current: lastTwoMonths[1][1], previous: lastTwoMonths[0][1] },
      });
    }
  }
  
  // Anomaly detection
  if (data.anomalies.length > 0) {
    insights.push({
      type: 'anomaly',
      title: 'Unusual Transaction Amounts',
      description: `${data.anomalies.length} transaction${data.anomalies.length > 1 ? 's' : ''} detected with amounts significantly different from the average (${formatCurrency(data.avgAmount)}). Review for accuracy.`,
      severity: 'medium',
      data: { count: data.anomalies.length, avgAmount: data.avgAmount },
    });
  }
  
  // Approval efficiency insight
  const totalProcessed = data.approvalStats.approved + data.approvalStats.rejected;
  if (totalProcessed > 0) {
    const rejectionRate = (data.approvalStats.rejected / totalProcessed) * 100;
    if (rejectionRate > 15) {
      insights.push({
        type: 'recommendation',
        title: 'High Rejection Rate',
        description: `Document rejection rate is ${rejectionRate.toFixed(1)}%. Consider reviewing submission guidelines or providing additional training to reduce rejections.`,
        severity: 'medium',
        data: { rate: rejectionRate },
      });
    }
  }
  
  // Try to generate AI-powered insights
  try {
    const zai = await ZAI.create();
    
    const prompt = `Analyze the following document management data and provide 2-3 actionable insights. 
Format each insight as JSON with: type (trend/anomaly/recommendation), title, description, severity (low/medium/high).

Data Summary:
- Total Documents: ${data.totalDocuments}
- Total Amount: ${formatCurrency(data.totalAmount)}
- Average Amount: ${formatCurrency(data.avgAmount)}
- Top 3 Vendors: ${data.topVendors.slice(0, 3).map(v => `${v[0]} (${formatCurrency(v[1].total)})`).join(', ')}
- Approval Status: ${data.approvalStats.approved} approved, ${data.approvalStats.rejected} rejected, ${data.approvalStats.pending} pending
- Monthly Trend: ${data.monthlyTrend.map(m => `${m[0]}: ${formatCurrency(m[1])}`).join(', ')}

Return a JSON array of insights. Focus on actionable recommendations for financial management.`;

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are a financial analyst AI assistant. Provide concise, actionable insights in JSON format only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 1000,
    });
    
    const content = completion.choices[0]?.message?.content;
    if (content) {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const aiInsights = JSON.parse(jsonMatch[0]);
        for (const insight of aiInsights) {
          if (!insights.find(i => i.title === insight.title)) {
            insights.push({
              type: insight.type || 'recommendation',
              title: insight.title,
              description: insight.description,
              severity: insight.severity || 'low',
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('AI insight generation error:', error);
    // Continue with rule-based insights
  }
  
  return insights.slice(0, 8); // Limit to 8 insights
}

function formatCurrency(amount: number): string {
  // Default to ZAR (South African Rand)
  return `R${amount.toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
