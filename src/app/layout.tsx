import type { Metadata } from "next";
import Script from "next/script";
import {
  Instrument_Sans,
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
import "@/components/design/base.css";
import "@/components/design/components.css";
import "@/components/design/app.css";
import "@/components/design/theme.css";

// Instrument Sans carries the Latin text (the free match for Era's Saans); the Noto families
// after it carry the Indian scripts, so every language keeps a proper font.
const ref = Instrument_Sans({ variable: "--font-ref", subsets: ["latin", "latin-ext"] });
const latin = Noto_Sans({ variable: "--font-noto", subsets: ["latin", "latin-ext"] });
const te = Noto_Sans_Telugu({ variable: "--font-te", subsets: ["telugu"] });
const ta = Noto_Sans_Tamil({ variable: "--font-ta", subsets: ["tamil"] });
const hi = Noto_Sans_Devanagari({ variable: "--font-hi", subsets: ["devanagari"] });
const kn = Noto_Sans_Kannada({ variable: "--font-kn", subsets: ["kannada"] });
const ml = Noto_Sans_Malayalam({ variable: "--font-ml", subsets: ["malayalam"] });
const bn = Noto_Sans_Bengali({ variable: "--font-bn", subsets: ["bengali"] });
const gu = Noto_Sans_Gujarati({ variable: "--font-gu", subsets: ["gujarati"] });

const description =
  "A voice agent that finds the same medicine at Jan Aushadhi prices, in your language, and works out the monthly saving.";

export const metadata: Metadata = {
  metadataBase: new URL("https://next-refill.vercel.app"),
  title: `${PRODUCT.name}: ${PRODUCT.tagline}`,
  description,
  openGraph: {
    title: `${PRODUCT.name}: ${PRODUCT.tagline}`,
    description,
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "Next Refill: the sample call's list, saving ₹302 a month" }],
  },
  twitter: { card: "summary_large_image", images: ["/og.jpg"] },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const fonts = [ref, latin, te, ta, hi, kn, ml, bn, gu].map((f) => f.variable).join(" ");
  return (
    <html lang="en" className={fonts} suppressHydrationWarning>
      <body>
        <Script src="/design/runtime.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
