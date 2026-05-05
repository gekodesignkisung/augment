import type { Metadata } from "next";
import "./globals.css";
import ToastHost from "./components/Toast";

export const metadata: Metadata = {
  title: "Augment — 사고를 위한 외골격",
  description: "엥겔바트의 철학으로 다시 짠 AI 작업대",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        {children}
        <ToastHost />
      </body>
    </html>
  );
}
