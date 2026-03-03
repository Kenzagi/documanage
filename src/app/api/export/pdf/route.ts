/**
 * PDF Export API Route
 * 
 * Generates professional PDF reports of approved documents using ReportLab.
 * This endpoint requires export_reports permission and only includes APPROVED documents.
 * 
 * Features:
 * - Summary statistics (total amount, VAT, document counts)
 * - Detailed document table with pagination support
 * - Professional styling with branded colors
 * 
 * @module API/Export/PDF
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { canPerformAction } from '@/types';
import { DocumentStatus, DocumentType } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

/**
 * GET /api/export/pdf
 * 
 * Generates and returns a PDF report of approved documents.
 * Supports filtering by date range, vendor, document type, and amount range.
 * 
 * Query Parameters:
 * - startDate: Filter documents from this date (YYYY-MM-DD)
 * - endDate: Filter documents until this date (YYYY-MM-DD)
 * - vendorName: Filter by vendor name (partial match)
 * - documentType: Filter by document types (comma-separated: INVOICE,CREDIT_NOTE)
 * - minAmount: Minimum total amount filter
 * - maxAmount: Maximum total amount filter
 * 
 * Returns: PDF file download
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Authentication and authorization check
    const user = await getCurrentUser();
    
    if (!user || !canPerformAction(user.role, 'export_reports')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Export permission required' },
        { status: 403 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    
    // Parse and validate filter parameters
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const vendorName = searchParams.get('vendorName');
    const documentType = searchParams.get('documentType')?.split(',') as DocumentType[] | null;
    const minAmount = searchParams.get('minAmount');
    const maxAmount = searchParams.get('maxAmount');
    
    // Build database query - Only export APPROVED documents
    const where: Record<string, unknown> = {
      status: DocumentStatus.APPROVED,
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
    
    // Fetch documents with uploader information
    const documents = await db.document.findMany({
      where,
      include: {
        uploader: {
          select: { name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    // Calculate summary statistics
    const totalAmount = documents.reduce((sum, d) => sum + (d.totalAmount || 0), 0);
    const totalVat = documents.reduce((sum, d) => sum + (d.vatAmount || 0), 0);
    const invoiceCount = documents.filter(d => d.type === 'INVOICE').length;
    const creditNoteCount = documents.filter(d => d.type === 'CREDIT_NOTE').length;
    
    // Prepare export directory
    const exportDir = path.join(process.cwd(), 'download');
    await fs.mkdir(exportDir, { recursive: true });
    
    const timestamp = Date.now();
    const filename = `document_report_${timestamp}.pdf`;
    const filepath = path.join(exportDir, filename);
    
    // Generate PDF using Python with robust error handling
    const pythonScript = path.join(exportDir, `generate_pdf_${timestamp}.py`);
    
    // Prepare document data as JSON
    const documentsJson = JSON.stringify(documents.map(d => ({
      invoiceNumber: d.invoiceNumber || 'N/A',
      vendorName: d.vendorName || 'N/A',
      documentDate: d.documentDate ? new Date(d.documentDate).toLocaleDateString('en-ZA') : 'N/A',
      type: d.type,
      amount: d.amount || 0,
      vatAmount: d.vatAmount || 0,
      totalAmount: d.totalAmount || 0,
      currency: d.currency || 'ZAR',
      status: d.status,
      uploader: d.uploader.name,
    })));
    
    // Create Python script for PDF generation
    // Uses ReportLab with built-in fonts for maximum compatibility
    const scriptContent = `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Document Management System - PDF Report Generator
Generates professional PDF reports with summary statistics and document details.
"""

from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.units import inch, cm
import json
import sys

# Document data passed from Node.js
data = ${documentsJson}

# Summary statistics
summary = {
    'total': ${totalAmount},
    'vat': ${totalVat},
    'count': ${documents.length},
    'invoices': ${invoiceCount},
    'creditNotes': ${creditNoteCount},
}

# Output file path
output_path = "${filepath}"

def create_pdf():
    """Generate the PDF report document."""
    # Create document with A4 page size
    doc = SimpleDocTemplate(
        output_path, 
        pagesize=A4,
        leftMargin=1.5*cm, 
        rightMargin=1.5*cm,
        topMargin=1.5*cm, 
        bottomMargin=1.5*cm
    )
    
    story = []
    styles = getSampleStyleSheet()
    
    # Custom styles using built-in Helvetica font
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        alignment=TA_CENTER,
        spaceAfter=20,
        textColor=colors.HexColor('#1a1a1a')
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=14,
        alignment=TA_LEFT,
        spaceAfter=10,
        textColor=colors.HexColor('#333333')
    )
    
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        alignment=TA_LEFT
    )
    
    # Title
    story.append(Paragraph("Document Management Report", title_style))
    story.append(Spacer(1, 10))
    
    # Generation date
    from datetime import datetime
    gen_date = datetime.now().strftime("%d %B %Y at %H:%M")
    story.append(Paragraph(f"Generated: {gen_date}", normal_style))
    story.append(Spacer(1, 20))
    
    # Summary Section
    story.append(Paragraph("Summary Statistics", heading_style))
    story.append(Spacer(1, 10))
    
    # Format currency as ZAR
    def format_currency(amount):
        return f"R {amount:,.2f}"
    
    summary_data = [
        ["Metric", "Value"],
        ["Total Documents", str(summary['count'])],
        ["Invoices", str(summary['invoices'])],
        ["Credit Notes", str(summary['creditNotes'])],
        ["Total Amount", format_currency(summary['total'])],
        ["Total VAT", format_currency(summary['vat'])],
    ]
    
    summary_table = Table(summary_data, colWidths=[3*inch, 2.5*inch])
    summary_table.setStyle(TableStyle([
        # Header row
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3b82f6')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        # Data rows
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('ALIGN', (0, 1), (0, -1), 'LEFT'),
        ('ALIGN', (1, 1), (1, -1), 'RIGHT'),
        # Grid
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e0e0e0')),
        # Alternating row colors
        ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor('#f8f9fa')),
        ('BACKGROUND', (0, 3), (-1, 3), colors.HexColor('#f8f9fa')),
        ('BACKGROUND', (0, 5), (-1, 5), colors.HexColor('#f8f9fa')),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 30))
    
    # Document Details Section
    story.append(Paragraph("Document Details", heading_style))
    story.append(Spacer(1, 10))
    
    if len(data) == 0:
        story.append(Paragraph("No approved documents found matching the criteria.", normal_style))
    else:
        # Table headers
        headers = ["Invoice #", "Vendor", "Date", "Type", "Amount", "VAT", "Total"]
        
        # Build table data
        table_data = [headers]
        for doc in data:
            # Format amounts
            amount_str = f"R {doc['amount']:,.2f}" if doc['amount'] else "R 0.00"
            vat_str = f"R {doc['vatAmount']:,.2f}" if doc['vatAmount'] else "R 0.00"
            total_str = f"R {doc['totalAmount']:,.2f}" if doc['totalAmount'] else "R 0.00"
            
            # Document type label
            type_label = "Invoice" if doc['type'] == "INVOICE" else "Credit Note"
            
            row = [
                str(doc['invoiceNumber'])[:15],
                str(doc['vendorName'])[:20],
                str(doc['documentDate']),
                type_label,
                amount_str,
                vat_str,
                total_str,
            ]
            table_data.append(row)
        
        # Calculate column widths based on page width
        page_width = A4[0] - 3*cm  # A4 width minus margins
        col_widths = [1.8*cm, 3.5*cm, 2.2*cm, 2*cm, 2.2*cm, 2*cm, 2.5*cm]
        
        # Create table
        doc_table = Table(table_data, colWidths=col_widths, repeatRows=1)
        
        doc_table.setStyle(TableStyle([
            # Header styling
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a1a1a')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            
            # Data row styling
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('ALIGN', (0, 1), (2, -1), 'LEFT'),
            ('ALIGN', (3, 1), (3, -1), 'CENTER'),
            ('ALIGN', (4, 1), (-1, -1), 'RIGHT'),
            
            # Padding
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
            
            # Grid
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#d0d0d0')),
            ('LINEBELOW', (0, 0), (-1, 0), 1.5, colors.HexColor('#1a1a1a')),
            
            # Alternating row colors
            *[('BACKGROUND', (0, i), (-1, i), colors.HexColor('#f5f5f5')) for i in range(2, len(table_data), 2)],
        ]))
        
        story.append(doc_table)
        
        # Footer note
        story.append(Spacer(1, 20))
        story.append(Paragraph(f"Total: {len(data)} document(s)", normal_style))
    
    # Build PDF
    doc.build(story)
    print("PDF generated successfully", file=sys.stderr)

if __name__ == "__main__":
    try:
        create_pdf()
    except Exception as e:
        print(f"Error generating PDF: {str(e)}", file=sys.stderr)
        sys.exit(1)
`;

    // Write Python script to disk
    await fs.writeFile(pythonScript, scriptContent);
    
    // Execute Python script with timeout
    try {
      const { stdout, stderr } = await execAsync(`python3 "${pythonScript}"`, {
        timeout: 30000, // 30 second timeout
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });
      
      console.log('Python stdout:', stdout);
      if (stderr) console.log('Python stderr:', stderr);
    } catch (error) {
      console.error('Python script execution error:', error);
      throw new Error('Failed to generate PDF file. Please try again.');
    }
    
    // Clean up Python script
    await fs.unlink(pythonScript).catch(() => {});
    
    // Verify PDF was created and read it
    try {
      const fileBuffer = await fs.readFile(filepath);
      
      // Verify it's a valid PDF by checking magic bytes
      const pdfHeader = fileBuffer.slice(0, 4).toString();
      if (pdfHeader !== '%PDF') {
        throw new Error('Generated file is not a valid PDF');
      }
      
      // Return PDF file with proper headers
      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="document_report.pdf"`,
          'Content-Length': fileBuffer.length.toString(),
          'Cache-Control': 'no-cache',
        },
      });
    } catch (readError) {
      console.error('Error reading generated PDF:', readError);
      throw new Error('Failed to read generated PDF file');
    }
    
  } catch (error) {
    console.error('PDF export error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate PDF report. Please try again.' },
      { status: 500 }
    );
  }
}
