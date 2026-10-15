import type { Metadata, Viewport } from "next";
import { Anuphan } from "next/font/google";
import "./globals.css";

// Variable font: every weight comes from one file per subset (2 requests instead of 8 with
// a static family like IBM Plex Sans Thai), which matters when every request is metered.
const thai = Anuphan({
  variable: "--font-thai",
  subsets: ["thai", "latin"],
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
  themeColor: "#f4f4f1",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" data-theme="light" suppressHydrationWarning className={`${thai.variable} antialiased`}>
      <body className="min-h-dvh font-sans">
        {/* Restore the saved theme before the page paints, including when storage is blocked. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{document.documentElement.dataset.theme=localStorage.getItem("ge6:theme")==="dark"?"dark":"light"}catch{}`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
