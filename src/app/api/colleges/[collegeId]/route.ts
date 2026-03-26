import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-guard";

const updateCollegeSchema = z
  .object({
    name: z.string().min(1).optional(),
    code: z.string().min(1).optional(),
    address: z.string().optional(),
    website: z.string().url().optional().or(z.literal("")),
    logoUrl: z.string().url().optional().or(z.literal("")),
    contactEmail: z.string().email().optional().or(z.literal("")),
    contactPhone: z.string().optional(),
    isActive: z.boolean().optional(),
    usnFormat: z.string().optional().nullable(),
    usnExample: z.string().optional().nullable(),
  });

type RouteParams = { params: Promise<{ collegeId: string }> };

// GET /api/colleges/[collegeId] — get a single college (super admin only)
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { id: string; role: string };
    if (user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { collegeId } = await params;

    const college = await prisma.college.findUnique({
      where: { id: collegeId },
      include: {
        _count: {
          select: {
            users: true,
            placementDrives: true,
          },
        },
      },
    });

    if (!college) {
      return NextResponse.json({ error: "College not found" }, { status: 404 });
    }

    return NextResponse.json(college);
  } catch (error) {
    console.error("GET /api/colleges/[collegeId] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/colleges/[collegeId] — update a college (super admin only)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { id: string; role: string };
    if (user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { collegeId } = await params;

    const existing = await prisma.college.findUnique({
      where: { id: collegeId },
    });
    if (!existing) {
      return NextResponse.json({ error: "College not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateCollegeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const college = await prisma.college.update({
      where: { id: collegeId },
      data: parsed.data,
    });

    return NextResponse.json(college);
  } catch (error) {
    console.error("PUT /api/colleges/[collegeId] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/colleges/[collegeId] — delete a college (super admin only)
// Pass ?deleteUsers=true to also delete all users belonging to this college
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { id: string; role: string };
    if (user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { collegeId } = await params;
    const deleteUsers = request.nextUrl.searchParams.get("deleteUsers") === "true";

    const existing = await prisma.college.findUnique({
      where: { id: collegeId },
    });
    if (!existing) {
      return NextResponse.json({ error: "College not found" }, { status: 404 });
    }

    if (deleteUsers) {
      await prisma.user.deleteMany({ where: { collegeId } });
    }

    await prisma.college.delete({ where: { id: collegeId } });

    return NextResponse.json({ message: "College deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/colleges/[collegeId] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
