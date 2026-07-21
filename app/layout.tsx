import type { Metadata } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import Shell from "@/components/Shell";

export const metadata: Metadata = {
  title: "ISO Smart Manager AI",
  description:
    "Автоматизирано изграждане и управление на интегрирани системи по ISO 9001, 14001, 45001, 27001 и 50001.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bg">
      <body>
        <StoreProvider>
          <Shell>{children}</Shell>
        </StoreProvider>
      </body>
    </html>
  );
}
