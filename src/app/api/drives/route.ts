import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-guard";
import { DriveStatus } from "@/generated/prisma/client";

const createDriveSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  companyName: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  status: z.nativeEnum(DriveStatus).optional(),
});

// GET /api/drives — list drives (filtered by collegeId for college admin, all for super admin)
export async function GET() {
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

    if (user.role !== "SUPER_ADMIN" && user.role !== "COLLEGE_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const where =
      user.role === "SUPER_ADMIN" ? {} : { collegeId: user.collegeId! };

    const drives = await prisma.placementDrive.findMany({
      where,
      include: {
        college: { select: { id: true, name: true, code: true } },
        _count: { select: { tests: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(drives);
  } catch (error) {
    console.error("GET /api/drives error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/drives — create a drive (college admin only, auto-set collegeId)
export async function POST(request: NextRequest) {
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

    if (user.role !== "COLLEGE_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!user.collegeId) {
      return NextResponse.json(
        { error: "No college assigned to your account" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = createDriveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const drive = await prisma.placementDrive.create({
      data: {
        ...parsed.data,
        startDate: parsed.data.startDate
          ? new Date(parsed.data.startDate)
          : undefined,
        endDate: parsed.data.endDate
          ? new Date(parsed.data.endDate)
          : undefined,
        collegeId: user.collegeId,
      },
      include: {
        college: { select: { id: true, name: true, code: true } },
      },
    });

    return NextResponse.json(drive, { status: 201 });
  } catch (error) {
    console.error("POST /api/drives error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
