import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import ffprobePath from "@ffprobe-installer/ffprobe";

const execFileAsync = promisify(execFile);

// Meme logique que pour les photos (src/lib/stamp.ts) : reduire le poids de
// stockage et le temps de chargement, tout en gardant une qualite correcte
// pour un visionnage web/mobile.
const MAX_DIMENSION = 1280;
const CRF = 28;

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), "lakymaps-video-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Compresse/redimensionne une video uploadee avant stockage (H.264 + AAC,
 * faststart pour un demarrage de lecture plus rapide sur le web). */
export async function compressVideo(buffer: Buffer): Promise<Buffer> {
  return withTempDir(async (dir) => {
    const inputPath = path.join(dir, "input");
    const outputPath = path.join(dir, "output.mp4");
    await writeFile(inputPath, buffer);

    const scaleFilter =
      `scale='if(gt(iw,ih),min(iw,${MAX_DIMENSION}),-2)':'if(gt(iw,ih),-2,min(ih,${MAX_DIMENSION}))'`;

    await execFileAsync(ffmpegPath.path, [
      "-y",
      "-i", inputPath,
      "-vf", scaleFilter,
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", String(CRF),
      "-c:a", "aac",
      "-b:a", "96k",
      "-movflags", "+faststart",
      outputPath,
    ]);

    return readFile(outputPath);
  });
}

/** Duree de la video en secondes, ou null si elle n'a pas pu etre lue. */
export async function getVideoDurationSeconds(buffer: Buffer): Promise<number | null> {
  return withTempDir(async (dir) => {
    const inputPath = path.join(dir, "input.mp4");
    await writeFile(inputPath, buffer);
    try {
      const { stdout } = await execFileAsync(ffprobePath.path, [
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        inputPath,
      ]);
      const seconds = Number(stdout.trim());
      return Number.isFinite(seconds) ? seconds : null;
    } catch {
      return null;
    }
  });
}

export type VideoLocation = { latitude: number; longitude: number; direction: number | null };

// Cle "location" au format ISO 6709 ecrite par la plupart des apps camera
// (iOS : com.apple.quicktime.location.ISO6709, Android : location), ex :
// "+48.8566+002.3522+035.000/". Le cap de prise de vue, lui, n'est presque
// jamais embarque dans un conteneur video (contrairement a l'EXIF photo) -
// on tente quand meme quelques cles connues, au mieux.
const LOCATION_TAG_KEYS = ["com.apple.quicktime.location.ISO6709", "location", "location-eng"];
const DIRECTION_TAG_KEYS = ["com.apple.quicktime.direction", "direction", "GPSImgDirection"];
const ISO6709_PATTERN = /^([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)/;

/** Extrait la position GPS (et le cap, si present) des metadonnees d'une
 * video, ou null si aucune metadonnee de localisation n'est embarquee. */
export async function getVideoLocationMetadata(buffer: Buffer): Promise<VideoLocation | null> {
  return withTempDir(async (dir) => {
    const inputPath = path.join(dir, "input.mp4");
    await writeFile(inputPath, buffer);
    try {
      const { stdout } = await execFileAsync(ffprobePath.path, [
        "-v", "error",
        "-print_format", "json",
        "-show_entries", "format_tags",
        inputPath,
      ]);
      const tags: Record<string, string> = JSON.parse(stdout)?.format?.tags ?? {};
      const tagEntries = Object.fromEntries(
        Object.entries(tags).map(([key, value]) => [key.toLowerCase(), value]),
      );

      const locationValue = LOCATION_TAG_KEYS.map((key) => tagEntries[key.toLowerCase()]).find(Boolean);
      if (!locationValue) return null;

      const match = ISO6709_PATTERN.exec(String(locationValue));
      if (!match) return null;
      const latitude = Number(match[1]);
      const longitude = Number(match[2]);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

      const directionValue = DIRECTION_TAG_KEYS.map((key) => tagEntries[key.toLowerCase()]).find(Boolean);
      const direction = directionValue !== undefined ? Number(directionValue) : NaN;

      return { latitude, longitude, direction: Number.isFinite(direction) ? direction : null };
    } catch {
      return null;
    }
  });
}
