import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { ApiResponse, canPerformAction } from '@/types';
import { readFile } from 'fs/promises';
import path from 'path';
import ZAI from 'z-ai-web-dev-sdk';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<{ extractionResult: Record<string, unknown> | null; error?: string }>>> {
  try {
    const user = await getCurrentUser();
    
    if (!user || !canPerformAction(user.role, 'upload')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }
    
    const { id } = await params;
    
    // Get document
    const document = await db.document.findUnique({
      where: { id },
    });
    
    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }
    
    // Read file
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const filePath = path.join(uploadsDir, document.filePath);
    
    try {
      const fileBuffer = await readFile(filePath);
      const base64Data = fileBuffer.toString('base64');
      
      console.log('Re-extraction: File read successfully, size:', fileBuffer.length, 'type:', document.mimeType);
      
      const zai = await ZAI.create();
      
      const documentTypeName = document.type === 'INVOICE' ? 'invoice' : 'credit note';
      
      const extractionPrompt = `Extract all information from this ${documentTypeName}. Return ONLY a JSON object with these exact fields (use null if not found):
{
  "invoiceNumber": "the invoice/credit note number",
  "vendorName": "the vendor/supplier company name", 
  "vendorAddress": "the vendor's full address",
  "documentDate": "document date in YYYY-MM-DD format",
  "dueDate": "payment due date in YYYY-MM-DD format",
  "amount": subtotal_amount_as_number,
  "vatAmount": vat_tax_amount_as_number,
  "totalAmount": total_amount_as_number,
  "currency": "currency code - default to ZAR (South African Rand) if not specified, otherwise use USD, EUR, GBP etc",
  "description": "brief description of items/services"
}

Important: Return ONLY the JSON object, no other text. All amounts must be numbers, not strings. Default currency is ZAR (South African Rand) if not clearly specified in the document.`;

      // Determine media type
      const mediaType = document.mimeType === 'application/pdf' ? 'application/pdf' : 
                        document.mimeType === 'image/png' ? 'image/png' :
                        document.mimeType === 'image/jpeg' ? 'image/jpeg' :
                        document.mimeType === 'image/webp' ? 'image/webp' : 'image/jpeg';
      
      console.log('Re-extraction: Calling Vision API for', mediaType);
      
      const completion = await zai.chat.completions.createVision({
        model: 'glm-4.6v',
        messages: [
          {
            role: 'assistant',
            content: [
              { type: 'text', text: 'Output only valid JSON, no markdown formatting.' }
            ]
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: extractionPrompt },
              document.mimeType === 'application/pdf' ? {
                type: 'file_url',
                file_url: {
                  url: `data:application/pdf;base64,${base64Data}`
                }
              } : {
                type: 'image_url',
                image_url: {
                  url: `data:${mediaType};base64,${base64Data}`
                }
              }
            ]
          }
        ],
        thinking: { type: 'disabled' }
      });
      
      const content_response = completion.choices?.[0]?.message?.content;
      console.log('Re-extraction response:', content_response);
      
      if (!content_response) {
        return NextResponse.json(
          { success: false, error: 'No data extracted from document' },
          { status: 400 }
        );
      }
      
      // Parse JSON from response
      let parsed: Record<string, unknown> | null = null;
      
      // Clean the response
      let cleanedContent = content_response.trim();
      if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
      }
      
      try {
        parsed = JSON.parse(cleanedContent);
      } catch {
        const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[0]);
          } catch (e) {
            console.error('Failed to parse JSON:', e);
          }
        }
      }
      
      if (!parsed) {
        return NextResponse.json(
          { success: false, error: 'Could not parse extracted data from AI response' },
          { status: 400 }
        );
      }
      
      // Helper function to parse numbers
      const parseNumber = (val: unknown): number | null => {
        if (typeof val === 'number' && !isNaN(val)) return val;
        if (typeof val === 'string') {
          const cleaned = val.replace(/[$€£¥,\s]/g, '').trim();
          const num = parseFloat(cleaned);
          return isNaN(num) ? null : num;
        }
        return null;
      };
      
      const extractionResult = {
        invoiceNumber: typeof parsed.invoiceNumber === 'string' ? parsed.invoiceNumber : null,
        vendorName: typeof parsed.vendorName === 'string' ? parsed.vendorName : null,
        vendorAddress: typeof parsed.vendorAddress === 'string' ? parsed.vendorAddress : null,
        documentDate: typeof parsed.documentDate === 'string' ? parsed.documentDate : null,
        dueDate: typeof parsed.dueDate === 'string' ? parsed.dueDate : null,
        amount: parseNumber(parsed.amount),
        vatAmount: parseNumber(parsed.vatAmount),
        totalAmount: parseNumber(parsed.totalAmount),
        currency: typeof parsed.currency === 'string' && parsed.currency ? parsed.currency.toUpperCase() : 'ZAR', // Default to ZAR
        description: typeof parsed.description === 'string' ? parsed.description : null,
      };
      
      console.log('Final re-extraction result:', extractionResult);
      
      // Update document with extracted data
      await db.document.update({
        where: { id },
        data: {
          invoiceNumber: extractionResult.invoiceNumber,
          vendorName: extractionResult.vendorName,
          vendorAddress: extractionResult.vendorAddress,
          documentDate: extractionResult.documentDate ? new Date(extractionResult.documentDate) : null,
          dueDate: extractionResult.dueDate ? new Date(extractionResult.dueDate) : null,
          amount: extractionResult.amount,
          vatAmount: extractionResult.vatAmount,
          totalAmount: extractionResult.totalAmount,
          currency: extractionResult.currency,
          description: extractionResult.description,
          extractedAt: new Date(),
        },
      });
      
      // Create audit log
      await db.auditLog.create({
        data: {
          userId: user.id,
          action: 'RE_EXTRACT_DOCUMENT',
          entityType: 'DOCUMENT',
          entityId: id,
          details: `Re-extracted data from document`,
        },
      });
      
      return NextResponse.json({
        success: true,
        extractionResult,
      });
      
    } catch (fileError) {
      console.error('File read error:', fileError);
      return NextResponse.json(
        { success: false, error: 'Could not read document file' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Re-extraction error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to extract document data' },
      { status: 500 }
    );
  }
}
