"use client";

// Starts Amplitude once, keeps its user in step with the login cookies, and
// records a "Page Viewed" event (path only) on every route change. Reading the
// cookies on each navigation covers login, logout, page reloads and View as
// without touching the four header logout buttons.

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { cookieManager } from "@/lib/cookies";
import { getCurrentUser } from "@/lib/user";
import { getViewAsInfo } from "@/lib/viewAs";
import { initAnalytics, syncAnalyticsUser, trackEvent } from "@/lib/analytics";

// During View as, the super admin's own identity is parked in this cookie.
function realUserAndViewAs() {
  const viewAs = getViewAsInfo();
  if (viewAs) {
    const original = cookieManager.getJSON("va_original_user");
    return { user: original || null, viewingAsRole: viewAs.role || "unknown" };
  }
  return { user: getCurrentUser(), viewingAsRole: null };
}

export default function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    if (!pathname) return;
    const { user, viewingAsRole } = realUserAndViewAs();
    syncAnalyticsUser(user, { viewingAsRole });
    trackEvent("Page Viewed", {
      path: pathname,
      // Same page for every client: /trainer/client/431 -> /trainer/client/:id
      page: pathname.replace(/\/\d+(?=\/|$)/g, "/:id"),
      section: pathname.split("/")[1] || "home",
      ...(viewingAsRole ? { viewing_as_role: viewingAsRole } : {}),
    });
  }, [pathname]);

  return null;
}
