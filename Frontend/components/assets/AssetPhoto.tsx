"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import { assetsApi } from "@/lib/api/assets";

export function AssetPhoto({ assetId, hasPhoto, alt, className, fallback, version = 0 }: Readonly<{
  assetId: string; hasPhoto: boolean; alt: string; className?: string; fallback: ReactNode; version?: number;
}>) {
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    let url: string | undefined;
    if (hasPhoto) assetsApi.photo(assetId).then((blob) => {
      url = URL.createObjectURL(blob);
      setSrc(url);
    }).catch(() => setSrc(undefined));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [assetId, hasPhoto, version]);
  return <span className={`relative overflow-hidden ${className ?? ""}`}>
    {src ? <Image src={src} alt={alt} fill unoptimized sizes="256px" className="object-cover" /> : fallback}
  </span>;
}
