"use client";

import { useEffect, useState } from "react";
import { fetchFailedRenewalsService } from "@/services/superAdminOrdersService";

// Renewal payments that failed (card declined) or are still unpaid a day later:
// the same request and totals as the Orders "Failed renewals" card and tab, newest
// first. Not tied to the page's dates or Trainer Admin view (the API has no such
// filters). data: { count, declined, pending, rows } or null when it could not load
// (for example a backend without view=failed_renewals).
export default function useFailedRenewals(limit = 20) {
  const [state, setState] = useState({ loading: true, data: null });
  useEffect(() => {
    let alive = true;
    fetchFailedRenewalsService({ limit })
      .then((res) => {
        if (!alive) return;
        if (res?.status === false || !res?.summary) throw new Error("failed");
        setState({
          loading: false,
          data: {
            count: res.summary.total || 0,
            declined: res.summary.failed || 0,
            pending: res.summary.pending || 0,
            rows: Array.isArray(res.failed_renewals) ? res.failed_renewals : [],
          },
        });
      })
      .catch(() => alive && setState({ loading: false, data: null }));
    return () => {
      alive = false;
    };
  }, [limit]);
  return state;
}
