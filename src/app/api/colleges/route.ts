import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-guard";

const createCollegeSchema = z.object({
  name: z.string().min(1, "Name is required"),
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

// GET /api/colleges — list all colleges (super admin only)
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { id: string; role: string };
    if (user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const colleges = await prisma.college.findMany({
      include: {
        _count: {
          select: {
            users: true,
            placementDrives: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(colleges);
  } catch (error) {
    console.error("GET /api/colleges error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/colleges — create a college (super admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { id: string; role: string };
    if (user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createCollegeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const code = parsed.data.code || nanoid(8).toUpperCase();

    const college = await prisma.college.create({
      data: {
        ...parsed.data,
        code,
      },
    });

    return NextResponse.json(college, { status: 201 });
  } catch (error) {
    console.error("POST /api/colleges error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
