import type { Metadata } from "next";

import { TooltipProvider } from "@/components/ui/tooltip";

import { Toaster } from "sonner";
import { AuthProvider } from "@/components/auth/auth-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "Faust OS",
  description: "Business Operating System",
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
