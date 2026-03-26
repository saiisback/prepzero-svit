import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/auth/departments?collegeCode=XXX — public endpoint to fetch departments by college code
export async function GET(request: NextRequest) {
  try {
    const collegeCode = new URL(request.url).searchParams.get("collegeCode");
    if (!collegeCode) {
      return NextResponse.json(
        { error: "College code is required" },
        { status: 400 }
      );
    }

    const college = await prisma.college.findUnique({
      where: { code: collegeCode },
      select: { id: true, isActive: true },
    });

    if (!college || !college.isActive) {
      return NextResponse.json({ departments: [] });
    }

    const departments = await prisma.department.findMany({
      where: { collegeId: college.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ departments });
  } catch (error) {
    console.error("GET /api/auth/departments error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
