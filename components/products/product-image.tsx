"use client";
/* eslint-disable @next/next/no-img-element -- sourced product photos come from external commerce hosts. */

import { PackageOpen } from "lucide-react";
import { useState } from "react";

export function ProductImage({ src, alt, className = "", fallbackClassName = "" }: { src?: string; alt: string; className?: string; fallbackClassName?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <div className={`grid place-items-center bg-black/35 text-muted-foreground ${fallbackClassName || className}`}><PackageOpen className="h-10 w-10 text-sky-100/70" /><span className="sr-only">No product image available</span></div>;
  return <img src={src} alt={alt} className={className} referrerPolicy="no-referrer" loading="lazy" decoding="async" onError={() => setFailed(true)} />;
}
