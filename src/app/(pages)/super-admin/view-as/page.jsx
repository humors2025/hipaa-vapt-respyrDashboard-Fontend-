"use client";

// Super Admin › View as — read-only impersonation.
//
// Lists every active trainer admin, facility admin and trainer that can log
// in (super-admin-view-as-list). "View" asks the backend for a view-only
// access token carrying that user's identity (super-admin-view-as), swaps the
// session to it (lib/viewAs.js) and lands on that role's home page — the
// dashboard then shows exactly what the user sees after login. The orange
// ViewAsBanner carries the "Exit view" that restores the super admin session.
//
// Every list view and every started view is written to the audit log; write
// endpoints are refused server-side while the view token is in use.

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Eye, Search } from "lucide-react";
import { fetchViewAsUsersService, startViewAsService } from "@/services/viewAsService";
import { enterViewAs } from "@/lib/viewAs";
import { landingPathForUser } from "@/lib/user";
import { SalesCard, Skeleton, EmptyState, SectionError } from "@/components/super-admin/sales/SalesUi";
import { SalesPagination } from "@/components/super-admin/sales/PurchaseTable";

const PAGE_LIMIT = 10;
const SEARCH_MIN_LENGTH = 3;

const ROLE_TABS = [
  { key: "all", label: "All" },
  { key: "admin", label: "Trainer admins" },
  { key: "facility_admin", label: "Facility admins" },
  { key: "trainer", label: "Trainers" },
];

const ROLE_LABEL = { admin: "Trainer admin", facility_admin: "Facility admin", trainer: "Trainer" };
const ROLE_BADGE = {
  admin: "bg-[#EEF4FE] text-[#308BF9]",
  facility_admin: "bg-[#FFF4E0] text-[#A66B00]",
  trainer: "bg-[#E5F6EE] text-[#1F7A4A]",
};

const Dash = () => <span className="text-[#A1A1A1]">—</span>;

function RoleBadge({ role }) {
  const key = String(role || "").toLowerCase();
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full text-[11px] font-semibold px-2.5 py-0.5 ${ROLE_BADGE[key] || "bg-[#F5F7FA] text-[#535359]"}`}>
      {ROLE_LABEL[key] || key}
    </span>
  );
}

export default function ViewAsPage() {
  const [role, setRole] = useState("all");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [startingFor, setStartingFor] = useState(null);
  const requestSeq = useRef(0);

  const load = useCallback(async (roleKey, pageNum, searchTerm) => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchViewAsUsersService({
        role: roleKey,
        page: pageNum,
        limit: PAGE_LIMIT,
        search: searchTerm,
      });
      if (seq !== requestSeq.current) return;
      setData(res);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setError(err?.data?.message || err?.message || "Failed to load users");
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(role, page, search);
  }, [role, page, search, load]);

  // Debounced search, 3-char minimum (matches the backend rule).
  useEffect(() => {
    const term = searchInput.trim();
    const effective = term.length >= SEARCH_MIN_LENGTH ? term : "";
    if (effective === search) return undefined;
    const t = setTimeout(() => {
      setPage(1);
      setSearch(effective);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput, search]);

  const handleRole = (key) => {
    if (key === role) return;
    setRole(key);
    setPage(1);
  };

  const handleView = async (user) => {
    if (startingFor) return;
    setStartingFor(user.user_id);
    try {
      const res = await startViewAsService(user.user_id);
      if (!res?.access_token) throw new Error("No view token returned");
      if (!enterViewAs(res.access_token)) throw new Error("Could not start the view session");
      // Full navigation so the Edge middleware and every header re-read the
      // swapped token. Role home comes from the frontend's own mapping.
      const target = res.target || {};
      window.location.assign(landingPathForUser({ role: target.role || user.role }));
    } catch (err) {
      toast.error(err?.data?.message || err?.message || "Could not start View as");
      setStartingFor(null);
    }
  };

  const items = data?.items || [];
  const pagination = data?.pagination || null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[#252525] text-[18px] font-bold">View as</h1>
        <p className="text-[#A1A1A1] text-[12px] mt-1">
          Open a read-only copy of the dashboard exactly as a trainer admin, facility admin or
          trainer sees it after login. Changes are disabled while viewing, and every view is
          recorded in the audit log.
        </p>
      </div>

      <SalesCard
        title="Users"
        action={
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1A1]" aria-hidden />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search name, email, code… (3+ chars)"
              className="w-[260px] max-w-full rounded-[10px] border border-[#E1E6ED] bg-white pl-8 pr-3 py-2 text-[12px] text-[#252525] placeholder:text-[#A1A1A1] outline-none focus:border-[#308BF9]"
            />
          </div>
        }
      >
        <div className="flex items-center gap-2 flex-wrap">
          {ROLE_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => handleRole(t.key)}
              className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold cursor-pointer transition-colors ${
                role === t.key
                  ? "bg-[#252525] text-white"
                  : "bg-[#F5F7FA] text-[#535359] hover:bg-[#ECF0F5]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error ? (
          <SectionError message={error} onRetry={() => load(role, page, search)} />
        ) : loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[44px]" />
            ))}
          </div>
        ) : !items.length ? (
          <EmptyState message={search ? "No users match this search." : "No users to show."} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[#A1A1A1] text-[11px] uppercase tracking-wide">
                  <th className="font-semibold px-3 py-2">Name</th>
                  <th className="font-semibold px-3 py-2">Email</th>
                  <th className="font-semibold px-3 py-2">Role</th>
                  <th className="font-semibold px-3 py-2">Partner code</th>
                  <th className="font-semibold px-3 py-2">Facility</th>
                  <th className="font-semibold px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((u) => (
                  <tr key={`${u.user_id}-${u.role}`} className="border-t border-[#F0F3F7] text-[12px] text-[#252525]">
                    <td className="px-3 py-2.5 font-semibold">{u.name || <Dash />}</td>
                    <td className="px-3 py-2.5">{u.user_id}</td>
                    <td className="px-3 py-2.5"><RoleBadge role={u.role} /></td>
                    <td className="px-3 py-2.5 font-mono text-[11px]">{u.partner_code || <Dash />}</td>
                    <td className="px-3 py-2.5">{u.facility_name || <Dash />}</td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleView(u)}
                        disabled={!!startingFor}
                        className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#308BF9] text-white text-[11px] font-bold px-3 py-1.5 hover:bg-[#1E78E8] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Eye size={13} aria-hidden />
                        {startingFor === u.user_id ? "Starting…" : "View"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && (
          <SalesPagination
            page={pagination.page}
            limit={pagination.limit}
            total={pagination.total}
            totalPages={pagination.total_pages}
            onPageChange={setPage}
            disabled={loading}
            noun="users"
          />
        )}
      </SalesCard>
    </div>
  );
}
