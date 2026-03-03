import { NextResponse } from 'next/server';
import { initializeDefaultUsers } from '@/lib/auth';

export async function GET() {
  try {
    await initializeDefaultUsers();
    return NextResponse.json({ success: true, message: 'Default users initialized' });
  } catch (error) {
    console.error('Init error:', error);
    return NextResponse.json({ success: false, error: 'Failed to initialize' }, { status: 500 });
  }
}
