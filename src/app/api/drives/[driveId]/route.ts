import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-guard";
import { DriveStatus } from "@/generated/prisma/client";

const updateDriveSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  companyName: z.string().optional(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  status: z.nativeEnum(DriveStatus).optional(),
});

type RouteParams = { params: Promise<{ driveId: string }> };

async function getDriveWithAuth(driveId: string) {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const user = session.user as {
    id: string;
    role: string;
    collegeId: string | null;
  };

  if (user.role !== "SUPER_ADMIN" && user.role !== "COLLEGE_ADMIN") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const drive = await prisma.placementDrive.findUnique({
    where: { id: driveId },
    include: {
      college: { select: { id: true, name: true, code: true } },
      _count: { select: { tests: true } },
    },
  });

  if (!drive) {
    return { error: NextResponse.json({ error: "Drive not found" }, { status: 404 }) };
  }

  // College admins can only access their own college's drives
  if (user.role === "COLLEGE_ADMIN" && drive.collegeId !== user.collegeId) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { session, user, drive };
}

// GET /api/drives/[driveId] — get a single drive
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { driveId } = await params;
    const result = await getDriveWithAuth(driveId);
    if ("error" in result) return result.error;

    return NextResponse.json(result.drive);
  } catch (error) {
    console.error("GET /api/drives/[driveId] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/drives/[driveId] — update a drive
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { driveId } = await params;
    const result = await getDriveWithAuth(driveId);
    if ("error" in result) return result.error;

    const body = await request.json();
    const parsed = updateDriveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.startDate !== undefined) {
      updateData.startDate = parsed.data.startDate
        ? new Date(parsed.data.startDate)
        : null;
    }
    if (parsed.data.endDate !== undefined) {
      updateData.endDate = parsed.data.endDate
        ? new Date(parsed.data.endDate)
        : null;
    }

    const drive = await prisma.placementDrive.update({
      where: { id: driveId },
      data: updateData,
      include: {
        college: { select: { id: true, name: true, code: true } },
      },
    });

    return NextResponse.json(drive);
  } catch (error) {
    console.error("PUT /api/drives/[driveId] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/drives/[driveId] — delete a drive
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { driveId } = await params;
    const result = await getDriveWithAuth(driveId);
    if ("error" in result) return result.error;

    await prisma.placementDrive.delete({ where: { id: driveId } });

    return NextResponse.json({ message: "Drive deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/drives/[driveId] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
