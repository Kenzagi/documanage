import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { ApiResponse, UserWithoutPassword } from '@/types';

export async function GET(): Promise<NextResponse<ApiResponse<{ user: UserWithoutPassword }>>> {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    const userWithoutPassword: UserWithoutPassword = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
    
    return NextResponse.json({
      success: true,
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json(
      { success: false, error: 'Session check failed' },
      { status: 500 }
    );
  }
}
