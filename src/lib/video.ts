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
