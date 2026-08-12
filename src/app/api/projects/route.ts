import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const projects = await prisma.project.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { photos: true } } },
  });

  return NextResponse.json({ projects });
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  address: z.string().trim().max(400).optional(),
  description: z.string().trim().max(2000).optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Nom de projet requis." }, { status: 400 });
  }

  const project = await prisma.project.create({
    data: { ...parsed.data, ownerId: user.id },
  });

  return NextResponse.json({ project }, { status: 201 });
}
