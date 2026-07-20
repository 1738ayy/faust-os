import type { Metadata } from "next";

import { TooltipProvider } from "@/components/ui/tooltip";

import { Toaster } from "sonner";
import { AuthProvider } from "@/components/auth/auth-provider";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || process.env.STAGING_APP_URL || "http://localhost:3000"),
  title: "Faust OS",
  description: "Business Operating System",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Faust OS",
    description: "Business Operating System",
    images: [{ url: "/brand/faust-snow-leopard.png", alt: "Faust Snow Leopard" }],
  },
  icons: {
    icon: [
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
      { url: "/brand/faust-snow-leopard.svg", type: "image/svg+xml" },
    ],
    apple: "/brand/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased dark"
    >
      <body className="min-h-full bg-background text-foreground">
        <AuthProvider><TooltipProvider>
          {children}

          <Toaster
            position="bottom-right"
            richColors
            closeButton
            expand
          />
        </TooltipProvider></AuthProvider>
      </body>
    </html>
  );
}
