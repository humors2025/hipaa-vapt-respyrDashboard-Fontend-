"use client";

import { Suspense } from "react";
import StickerPosterSheet from "@/components/facilities/StickerPosterSheet";

export default function StickerPrintPage() {
  return (
    <Suspense fallback={null}>
      <StickerPosterSheet />
    </Suspense>
  );
}
