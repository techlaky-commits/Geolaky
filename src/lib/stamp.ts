import sharp from "sharp";
import piexif from "piexifjs";

// Taille/qualite max des images stockees : suffisant pour un affichage web
// et un rapport PDF net, tout en gardant les fichiers tres legers en
// stockage (un JPEG telephone de 4000x3000 a 100% passe generalement de
// plusieurs Mo a quelques centaines de Ko apres ce traitement).
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 78;

/** Corrige l'orientation EXIF et redimensionne/recompresse une image
 * uploadee, avant stockage. A appliquer a l'original ET au tampon. */
export async function normalizeImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
}

/** Ecrit la direction de prise de vue dans le tag EXIF standard
 * GPSImgDirection (0-360 degres, reference "T" = Nord vrai), en plus de la
 * valeur deja conservee dans les donnees internes (Photo.direction) qui
 * pilote l'affichage carte/boussole. Best-effort : en cas d'echec (JPEG
 * inhabituel, etc.), renvoie l'image inchangee plutot que de faire echouer
 * tout l'upload pour une metadonnee secondaire. */
export function embedGpsDirection(jpegBuffer: Buffer, direction: number): Buffer {
  try {
    const binary = jpegBuffer.toString("binary");
    const exifObj = piexif.load(binary);
    const normalized = ((direction % 360) + 360) % 360;
    exifObj.GPS = exifObj.GPS ?? {};
    exifObj.GPS[piexif.GPSIFD.GPSImgDirection] = [Math.round(normalized * 100), 100];
    exifObj.GPS[piexif.GPSIFD.GPSImgDirectionRef] = "T";
    const exifBytes = piexif.dump(exifObj);
    const withExif = piexif.insert(exifBytes, binary);
    return Buffer.from(withExif, "binary");
  } catch {
    return jpegBuffer;
  }
}

export type CropData = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // degres, applique avant le recadrage
};

export type StampFields = {
  title: string; // nom du projet ou libelle principal
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  capturedAt: Date;
  note: string | null;
};

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatCoords(lat: number | null, lon: number | null) {
  if (lat === null || lon === null) return null;
  return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
}

export function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/** Decoupe une chaine en plusieurs lignes d'une longueur max (en caracteres). */
function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function buildStampSvg(width: number, fields: StampFields): { svg: Buffer; barHeight: number } {
  const fontTitle = Math.max(16, Math.round(width * 0.028));
  const fontBody = Math.max(13, Math.round(width * 0.02));
  const padding = Math.round(width * 0.03);
  const maxCharsAddress = Math.floor((width - padding * 2 - fontBody * 2) / (fontBody * 0.52));

  const coords = formatCoords(fields.latitude, fields.longitude);
  const addressLines = fields.address ? wrapText(fields.address, maxCharsAddress) : [];

  const textLines: { text: string; size: number; weight: string }[] = [
    { text: fields.title, size: fontTitle, weight: "700" },
    ...addressLines.map((l) => ({ text: l, size: fontBody, weight: "400" })),
    ...(coords
      ? [
          {
            text: `${coords}${fields.accuracy ? `  (±${Math.round(fields.accuracy)} m)` : ""}`,
            size: fontBody,
            weight: "400",
          },
        ]
      : []),
    { text: formatDateTime(fields.capturedAt), size: fontBody, weight: "400" },
    ...(fields.note ? wrapText(fields.note, maxCharsAddress).map((l) => ({ text: l, size: fontBody, weight: "400" })) : []),
  ];

  const totalTextHeight = textLines.reduce((sum, l) => sum + Math.round(l.size * 1.45), 0);
  const barHeight = padding * 2 + totalTextHeight;

  // Position de la ligne de base du premier libelle, en partant du haut de la barre.
  let y = padding + Math.round(textLines[0].size * 0.85);

  const pinX = padding + 10;
  const pinY = barHeight / 2;

  const textNodes = textLines
    .map((line) => {
      const node = `<text x="${padding + 34}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${line.size}" font-weight="${line.weight}" fill="#ffffff">${escapeXml(
        line.text,
      )}</text>`;
      y += Math.round(line.size * 1.45);
      return node;
    })
    .join("");

  const svg = `
    <svg width="${width}" height="${barHeight}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#000000" stop-opacity="0.35" />
          <stop offset="100%" stop-color="#000000" stop-opacity="0.72" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${width}" height="${barHeight}" fill="url(#bar)" />
      <circle cx="${pinX}" cy="${pinY}" r="9" fill="#ff5a5f" />
      <circle cx="${pinX}" cy="${pinY}" r="3.2" fill="#ffffff" />
      ${textNodes}
    </svg>
  `.trim();

  return { svg: Buffer.from(svg), barHeight };
}

/** Applique recadrage + rotation optionnels, puis compose le tampon geoloc en bas de l'image. */
export async function renderStampedImage(
  originalBuffer: Buffer,
  fields: StampFields,
  crop?: CropData | null,
): Promise<Buffer> {
  let pipeline = sharp(originalBuffer).rotate(); // corrige l'orientation EXIF d'origine

  if (crop && crop.rotation % 360 !== 0) {
    pipeline = pipeline.rotate(crop.rotation, { background: "#000000" });
  }
  if (crop) {
    const meta = await pipeline.clone().toBuffer({ resolveWithObject: true });
    const { width: w, height: h } = meta.info;
    const left = Math.max(0, Math.min(Math.round(crop.x), w - 1));
    const top = Math.max(0, Math.min(Math.round(crop.y), h - 1));
    const cropWidth = Math.max(1, Math.min(Math.round(crop.width), w - left));
    const cropHeight = Math.max(1, Math.min(Math.round(crop.height), h - top));
    pipeline = sharp(meta.data).extract({ left, top, width: cropWidth, height: cropHeight });
  }

  const base = await pipeline.jpeg({ quality: JPEG_QUALITY }).toBuffer({ resolveWithObject: true });
  const { svg } = buildStampSvg(base.info.width, fields);

  return sharp(base.data)
    .composite([{ input: svg, gravity: "south" }])
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
}
