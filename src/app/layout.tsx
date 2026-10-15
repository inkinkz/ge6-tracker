import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";

const thai = IBM_Plex_Sans_Thai({
  variable: "--font-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "GE6 Vote Tracker — ติดตามยอดโหวต BNK48 & CGM48 แบบเรียลไทม์",
  description:
    "ติดตามยอดโทเคน GE6 ที่ใช้โหวต BNK48 & CGM48 General Election ครั้งที่ 6 แบบเรียลไทม์จากบล็อกเชน Token X: ยอดรวม จำนวนกระเป๋า อันดับกระเป๋าที่โหวตมากที่สุด และความเคลื่อนไหวล่าสุด",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f4f1" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0d" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${thai.variable} antialiased`}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
