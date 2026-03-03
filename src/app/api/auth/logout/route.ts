import { NextResponse } from 'next/server';
import { clearAuthCookie, getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { ApiResponse } from '@/types';

export async function POST(): Promise<NextResponse<ApiResponse>> {
  try {
    const user = await getCurrentUser();
    
    if (user) {
      // Create audit log
      await db.auditLog.create({
        data: {
          userId: user.id,
          action: 'LOGOUT',
          entityType: 'USER',
          entityId: user.id,
          details: 'User logged out',
        },
      });
    }
    
    await clearAuthCookie();
    
    return NextResponse.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    await clearAuthCookie();
    return NextResponse.json({ success: true, message: 'Logged out' });
  }
}
