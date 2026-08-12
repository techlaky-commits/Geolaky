import sharp from "sharp";
import { mkdir } from "fs/promises";
import path from "path";

const outDir = path.resolve(process.cwd(), "public/icons");

function iconSvg(size, { padded } = {}) {
  const pin = padded ? size * 0.62 : size * 0.8;
  const cx = size / 2;
  const cy = size / 2;
  return `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="#1f7aec" />
      <g transform="translate(${cx}, ${cy - pin * 0.08})">
        <path d="M0 ${-pin * 0.42}
                 C ${pin * 0.28} ${-pin * 0.42} ${pin * 0.42} ${-pin * 0.12} ${pin * 0.42} ${pin * 0.1}
                 C ${pin * 0.42} ${pin * 0.42} 0 ${pin * 0.62} 0 ${pin * 0.62}
                 C 0 ${pin * 0.62} ${-pin * 0.42} ${pin * 0.42} ${-pin * 0.42} ${pin * 0.1}
                 C ${-pin * 0.42} ${-pin * 0.12} ${-pin * 0.28} ${-pin * 0.42} 0 ${-pin * 0.42} Z"
              fill="#ffffff" />
        <circle cx="0" cy="${-pin * 0.08}" r="${pin * 0.16}" fill="#1f7aec" />
      </g>
    </svg>
  `.trim();
}

await mkdir(outDir, { recursive: true });

await sharp(Buffer.from(iconSvg(192))).png().toFile(path.join(outDir, "icon-192.png"));
await sharp(Buffer.from(iconSvg(512))).png().toFile(path.join(outDir, "icon-512.png"));
await sharp(Buffer.from(iconSvg(512, { padded: true }))).png().toFile(
  path.join(outDir, "icon-maskable-512.png"),
);

console.log("Icones PWA generees dans public/icons/");
