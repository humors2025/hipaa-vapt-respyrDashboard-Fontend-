"use client";

import { Suspense } from "react";
import StickerPosterSheet from "@/components/facilities/StickerPosterSheet";

// Evan and Derek take these into the field. /super-admin/* is role-gated, so the
// trainer admins need their own route to the same sheet; listQrService already
// scopes the rows to the stickers they hold.
export default function TrainerAdminStickerPrintPage() {
  return (
    <Suspense fallback={null}>
      <StickerPosterSheet />
    </Suspense>
  );
}
