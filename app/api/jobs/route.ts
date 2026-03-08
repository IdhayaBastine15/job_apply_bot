import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const jobs = await prisma.savedJob.findMany({
      orderBy: { savedAt: "desc" },
    });
    return NextResponse.json(jobs);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, company, location, description, link, contact, salary, source } = body;

    if (!title || !company || !location) {
      return NextResponse.json(
        { error: "title, company, and location are required" },
        { status: 400 }
      );
    }

    const job = await prisma.savedJob.create({
      data: {
        title,
        company,
        location,
        description: description ?? null,
        link: link ?? null,
        contact: contact ?? null,
        salary: salary ?? null,
        source: source ?? null,
        status: "no_reply",
      },
    });
    return NextResponse.json(job, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to save job" }, { status: 500 });
  }
}
