import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { success: false, message: 'Name, email, and password are required.' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, message: 'Password must be at least 6 characters.' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, message: 'This email address is already in use by another account.' },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        role: 'Researcher',
        status: 'pending_approval',
        avatarUrl: 'https://placehold.co/100x100.png',
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: newUser.id,
        userName: newUser.name,
        action: 'USER_CREATED',
        entityType: 'User',
        entityId: newUser.id,
        details: `User ${newUser.name} (${newUser.email}) signed up. Status: pending_approval.`,
      },
    });

    // Notify admin users
    try {
      const adminUsers = await prisma.user.findMany({
        where: { role: 'Admin', status: 'active' },
        select: { id: true },
      });

      if (adminUsers.length > 0) {
        await prisma.notification.createMany({
          data: adminUsers.map(admin => ({
            userId: admin.id,
            title: 'New Signup Request',
            message: `User ${newUser.name} (${newUser.email}) has signed up and is awaiting approval.`,
            type: 'signup_pending_admin',
            linkTo: '/admin/users',
          })),
        });
      }
    } catch {
      // Non-critical — admin notification failure shouldn't block signup
    }

    return NextResponse.json({
      success: true,
      message: 'Signup successful! Your request is awaiting admin approval.',
      userId: newUser.id,
    });
  } catch (error) {
    console.error('[POST /api/auth/signup] Error:', error);
    return NextResponse.json(
      { success: false, message: 'An unexpected error occurred during signup.' },
      { status: 500 }
    );
  }
}
