import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-guard";

// GET /api/notifications — fetch notifications for college admin
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as {
      id: string;
      role: string;
      collegeId: string | null;
    };

    if (user.role !== "COLLEGE_ADMIN" || !user.collegeId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(request.url);
    const unreadOnly = url.searchParams.get("unread") === "true";

    const notifications = await prisma.notification.findMany({
      where: {
        collegeId: user.collegeId,
        ...(unreadOnly ? { isRead: false } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const unreadCount = await prisma.notification.count({
      where: {
        collegeId: user.collegeId,
        isRead: false,
      },
    });

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error("GET /api/notifications error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/notifications — mark notifications as read
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as {
      id: string;
      role: string;
      collegeId: string | null;
    };

    if (user.role !== "COLLEGE_ADMIN" || !user.collegeId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { ids, markAllRead } = body as {
      ids?: string[];
      markAllRead?: boolean;
    };

    if (markAllRead) {
      await prisma.notification.updateMany({
        where: { collegeId: user.collegeId, isRead: false },
        data: { isRead: true },
      });
    } else if (ids && ids.length > 0) {
      await prisma.notification.updateMany({
        where: {
          id: { in: ids },
          collegeId: user.collegeId,
        },
        data: { isRead: true },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/notifications error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/notifications — delete notifications by IDs or all
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as {
      id: string;
      role: string;
      collegeId: string | null;
    };

    if (user.role !== "COLLEGE_ADMIN" || !user.collegeId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { ids, deleteAll } = body as {
      ids?: string[];
      deleteAll?: boolean;
    };

    if (deleteAll) {
      await prisma.notification.deleteMany({
        where: { collegeId: user.collegeId },
      });
    } else if (ids && ids.length > 0) {
      await prisma.notification.deleteMany({
        where: {
          id: { in: ids },
          collegeId: user.collegeId,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/notifications error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
