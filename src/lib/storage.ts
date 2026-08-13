import { mkdir, readFile, writeFile, unlink } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const STORAGE_DIR = path.resolve(process.cwd(), process.env.STORAGE_DIR || "./storage");

function projectDir(projectId: string) {
  return path.join(STORAGE_DIR, projectId);
}

/** Resout un chemin relatif stocke en base vers un chemin absolu sur disque. */
export function resolveStoragePath(relativePath: string) {
  const resolved = path.resolve(STORAGE_DIR, relativePath);
  if (!resolved.startsWith(STORAGE_DIR)) {
    throw new Error("Chemin de stockage invalide");
  }
  return resolved;
}

export async function saveProjectFile(
  projectId: string,
  buffer: Buffer,
  kind: "original" | "stamped" | "cover",
  ext = "jpg",
) {
  const dir = projectDir(projectId);
  await mkdir(dir, { recursive: true });
  const filename = `${randomUUID()}-${kind}.${ext}`;
  const absolutePath = path.join(dir, filename);
  await writeFile(absolutePath, buffer);
  // Toujours en "/" (meme sous Windows) : ce chemin sert aussi de segment d'URL (/api/files/...).
  return `${projectId}/${filename}`;
}

export async function overwriteProjectFile(relativePath: string, buffer: Buffer) {
  const absolutePath = resolveStoragePath(relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);
}

export async function readProjectFile(relativePath: string) {
  return readFile(resolveStoragePath(relativePath));
}

export async function deleteProjectFile(relativePath: string) {
  try {
    await unlink(resolveStoragePath(relativePath));
  } catch {
    // fichier deja absent : rien a faire
  }
}
