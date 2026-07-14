import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hadith Shorts Generator",
  description: "Hadith Studio for short-form video and image generation."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
