import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ISO сертифициране",
  description: "Платформа за внедряване и управление на интегрирани ISO системи."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="bg"><body>{children}</body></html>;
}
