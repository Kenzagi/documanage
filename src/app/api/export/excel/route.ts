import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { ApiResponse, canPerformAction } from '@/types';
import { DocumentStatus, DocumentType } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

export async function GET(request: NextRequest): Promise<NextResponse> {
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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const vendorName = searchParams.get('vendorName');
    const status = searchParams.get('status')?.split(',') as DocumentStatus[] | null;
    const documentType = searchParams.get('documentType')?.split(',') as DocumentType[] | null;
    const minAmount = searchParams.get('minAmount');
    const maxAmount = searchParams.get('maxAmount');
    
    // Build where clause - Only export APPROVED documents
    const where: Record<string, unknown> = {
      status: DocumentStatus.APPROVED, // Only approved documents in exports
    };
    
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
    
    // Get documents
    const documents = await db.document.findMany({
      where,
      include: {
        uploader: {
          select: { name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    // Generate Excel file using Python
    const exportDir = path.join(process.cwd(), 'download');
    await fs.mkdir(exportDir, { recursive: true });
    
    const timestamp = Date.now();
    const filename = `document_report_${timestamp}.xlsx`;
    const filepath = path.join(exportDir, filename);
    
    // Create Python script for Excel generation
    const pythonScript = path.join(exportDir, `generate_excel_${timestamp}.py`);
    
    const scriptContent = `
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
import json

# Data from API
data = ${JSON.stringify(documents.map(d => ({
  invoiceNumber: d.invoiceNumber || 'N/A',
  vendorName: d.vendorName || 'N/A',
  documentDate: d.documentDate ? new Date(d.documentDate).toLocaleDateString() : 'N/A',
  type: d.type,
  amount: d.amount || 0,
  vatAmount: d.vatAmount || 0,
  totalAmount: d.totalAmount || 0,
  currency: d.currency || 'USD',
  status: d.status,
  uploader: d.uploader.name,
  createdAt: new Date(d.createdAt).toLocaleDateString(),
})))}

# Create workbook
wb = Workbook()
ws = wb.active
ws.title = "Documents"

# Styles
header_font = Font(bold=True, color="FFFFFF", size=11)
header_fill = PatternFill(start_color="1F4E79", end_color="1F4E79", fill_type="solid")
header_alignment = Alignment(horizontal="center", vertical="center")
border = Border(
    left=Side(style='thin'),
    right=Side(style='thin'),
    top=Side(style='thin'),
    bottom=Side(style='thin')
)

# Headers
headers = ["Invoice #", "Vendor", "Date", "Type", "Amount", "VAT", "Total", "Currency", "Status", "Uploaded By", "Created"]
for col, header in enumerate(headers, 1):
    cell = ws.cell(row=1, column=col, value=header)
    cell.font = header_font
    cell.fill = header_fill
    cell.alignment = header_alignment
    cell.border = border

# Data rows
for row_idx, doc in enumerate(data, 2):
    values = [
        doc['invoiceNumber'],
        doc['vendorName'],
        doc['documentDate'],
        doc['type'],
        doc['amount'],
        doc['vatAmount'],
        doc['totalAmount'],
        doc['currency'],
        doc['status'],
        doc['uploader'],
        doc['createdAt'],
    ]
    for col_idx, value in enumerate(values, 1):
        cell = ws.cell(row=row_idx, column=col_idx, value=value)
        cell.border = border
        cell.alignment = Alignment(horizontal="center" if col_idx <= 4 else "left")
        
        # Alternate row colors
        if row_idx % 2 == 0:
            cell.fill = PatternFill(start_color="F5F5F5", end_color="F5F5F5", fill_type="solid")

# Auto-adjust column widths
column_widths = [15, 25, 12, 12, 12, 10, 12, 10, 15, 20, 12]
for i, width in enumerate(column_widths, 1):
    ws.column_dimensions[get_column_letter(i)].width = width

# Save
wb.save("${filepath}")
print("Excel file generated successfully")
`;

    await fs.writeFile(pythonScript, scriptContent);
    
    // Execute Python script
    try {
      await execAsync(`python3 "${pythonScript}"`);
    } catch (error) {
      console.error('Python script error:', error);
      throw new Error('Failed to generate Excel file');
    }
    
    // Clean up Python script
    await fs.unlink(pythonScript).catch(() => {});
    
    // Return file
    const fileBuffer = await fs.readFile(filepath);
    
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Excel export error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate Excel report' },
      { status: 500 }
    );
  }
}
