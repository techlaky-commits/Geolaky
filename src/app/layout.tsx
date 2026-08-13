import type { Metadata, Viewport } from "next";
import { Mulish, Raleway } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { PwaRegister } from "@/components/PwaRegister";
import { Nav } from "@/components/Nav";
import { MainShell } from "@/components/MainShell";

const mulish = Mulish({
  subsets: ["latin"],
  variable: "--font-mulish",
  weight: ["400", "500", "600", "700"],
});
const raleway = Raleway({
  subsets: ["latin"],
  variable: "--font-raleway",
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: "LakyMaps",
  description: "Photos geolocalisees pour visites de site",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "LakyMaps",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#006f9c",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${mulish.variable} ${raleway.variable}`}>
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
