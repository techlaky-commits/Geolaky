import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { readProjectFile } from "@/lib/storage";

export const runtime = "nodejs";

const PAGE_WIDTH = 595.28; // A4 en points
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const project = await prisma.project.findFirst({
    where: { id: params.id, ownerId: user.id },
    include: { photos: { orderBy: { capturedAt: "asc" } } },
  });
  if (!project) return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });

  const pdf = await PDFDocument.create();
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);

  const cover = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  cover.drawText(project.name, {
    x: MARGIN,
    y: PAGE_HEIGHT - 120,
    size: 26,
    font: fontBold,
    color: rgb(0.07, 0.16, 0.36),
  });
  if (project.address) {
    cover.drawText(project.address, {
      x: MARGIN,
      y: PAGE_HEIGHT - 150,
      size: 13,
      font: fontRegular,
      color: rgb(0.3, 0.3, 0.3),
    });
  }
  cover.drawText(
    `Rapport genere le ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(new Date())}`,
    { x: MARGIN, y: PAGE_HEIGHT - 178, size: 11, font: fontRegular, color: rgb(0.4, 0.4, 0.4) },
  );
  cover.drawText(`${project.photos.length} photo(s) geolocalisee(s)`, {
    x: MARGIN,
    y: PAGE_HEIGHT - 196,
    size: 11,
    font: fontRegular,
    color: rgb(0.4, 0.4, 0.4),
  });

  let index = 1;
  for (const photo of project.photos) {
    const buffer = await readProjectFile(photo.stampedPath).catch(() => null);
    if (!buffer) continue;

    const image = await pdf.embedJpg(buffer);
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

    const maxWidth = PAGE_WIDTH - MARGIN * 2;
    const maxHeight = PAGE_HEIGHT - MARGIN * 2 - 30;
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;

    page.drawText(`${project.name} - Photo ${index}/${project.photos.length}`, {
      x: MARGIN,
      y: PAGE_HEIGHT - MARGIN + 6,
      size: 10,
      font: fontRegular,
      color: rgb(0.4, 0.4, 0.4),
    });

    page.drawImage(image, {
      x: (PAGE_WIDTH - drawWidth) / 2,
      y: (PAGE_HEIGHT - drawHeight) / 2 - 10,
      width: drawWidth,
      height: drawHeight,
    });

    index += 1;
  }

  const bytes = Buffer.from(await pdf.save());
  const safeName = project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "rapport";

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="rapport-${safeName}.pdf"`,
    },
  });
}
