import type { Metadata } from "next";
import {
  Noto_Sans,
  Noto_Sans_Bengali,
  Noto_Sans_Devanagari,
  Noto_Sans_Gujarati,
  Noto_Sans_Kannada,
  Noto_Sans_Malayalam,
  Noto_Sans_Tamil,
  Noto_Sans_Telugu,
} from "next/font/google";
import { PRODUCT } from "@/lib/brand";
import "./globals.css";

const latin = Noto_Sans({ variable: "--font-noto", subsets: ["latin"] });
const te = Noto_Sans_Telugu({ variable: "--font-te", subsets: ["telugu"] });
const ta = Noto_Sans_Tamil({ variable: "--font-ta", subsets: ["tamil"] });
const hi = Noto_Sans_Devanagari({ variable: "--font-hi", subsets: ["devanagari"] });
const kn = Noto_Sans_Kannada({ variable: "--font-kn", subsets: ["kannada"] });
const ml = Noto_Sans_Malayalam({ variable: "--font-ml", subsets: ["malayalam"] });
const bn = Noto_Sans_Bengali({ variable: "--font-bn", subsets: ["bengali"] });
const gu = Noto_Sans_Gujarati({ variable: "--font-gu", subsets: ["gujarati"] });

export const metadata: Metadata = {
  title: `${PRODUCT.name}: ${PRODUCT.tagline}`,
  description:
    "A voice agent that finds the same medicine at Jan Aushadhi prices, in your language, and works out the monthly saving.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const fonts = [latin, te, ta, hi, kn, ml, bn, gu].map((f) => f.variable).join(" ");
  return (
    <html lang="en" className={`${fonts} h-full antialiased`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
