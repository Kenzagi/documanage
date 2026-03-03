import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, getCurrentUser } from '@/lib/auth';
import { ApiResponse, UserWithoutPassword } from '@/types';
import { canPerformAction } from '@/types';

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<{ user: UserWithoutPassword }>>> {
  try {
    const currentUser = await getCurrentUser();
    
    // Only admins can create new users
    if (!currentUser || !canPerformAction(currentUser.role, 'manage_users')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    const { email, password, name, role = 'VIEWER' } = body;
    
    if (!email || !password || !name) {
      return NextResponse.json(
        { success: false, error: 'Email, password, and name are required' },
        { status: 400 }
      );
    }
    
    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'User with this email already exists' },
        { status: 400 }
      );
    }
    
    // Hash password
    const passwordHash = await hashPassword(password);
    
    // Create user
    const user = await db.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name,
        role,
      },
    });
    
    // Create audit log
    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: 'CREATE_USER',
        entityType: 'USER',
        entityId: user.id,
        details: `Created user ${user.email} with role ${user.role}`,
      },
    });
    
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
    console.error('Register error:', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred during registration' },
      { status: 500 }
    );
  }
}
