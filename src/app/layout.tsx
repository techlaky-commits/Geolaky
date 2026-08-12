import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { PwaRegister } from "@/components/PwaRegister";
import { Nav } from "@/components/Nav";
import { MainShell } from "@/components/MainShell";

export const metadata: Metadata = {
  title: "Geolaky",
  description: "Photos geolocalisees pour visites de site",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Geolaky",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#1f7aec",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="flex min-h-screen flex-col">
        <Providers>
          <PwaRegister />
          <Nav />
          <MainShell>{children}</MainShell>
        </Providers>
      </body>
    </html>
  );
}
