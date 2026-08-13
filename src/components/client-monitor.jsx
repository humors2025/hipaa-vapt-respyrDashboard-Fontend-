
"use client";

import { useState, useEffect } from "react";
import ClientTable from "./clientTable";
import { UserProfile } from "./user-profile";
import { fetchClientsDashboard } from "../services/authService";
import { cookieManager } from "../lib/cookies";
import { useSelector, useDispatch } from "react-redux";
import { setSummary } from "../store/clientsDashboardSlice";

const ITEMS_PER_PAGE = 10;

export default function ClientsSection() {
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [cache, setCache] = useState({});

  const summary = useSelector((state) => state.clients.summary);
  const selectedDate = useSelector((state) => state.date.selectedDate);
  const dispatch = useDispatch();

  const formattedDate = `${selectedDate.year}-${String(selectedDate.month).padStart(2, "0")}-${String(selectedDate.day).padStart(2, "0")}`;

  const handleSearchResults = (results) => {
    setSearchResults(results);
  };

  useEffect(() => {
    if (!search.trim()) {
      loadClients();
    }
  }, [activeTab, page, formattedDate, search]);

  const loadClients = async () => {
    const cacheKey = `${activeTab}-${page}-${formattedDate}`;

    try {
      if (cache[cacheKey]) {
        setClients(cache[cacheKey]);
        return;
      }

      setLoading(true);

      const dietician = cookieManager.getJSON("dietician");
      const dieticianId = dietician?.dietician_id;

      if (!dieticianId) {
        console.error("Dietician ID not found");
        return;
      }

      const res = await fetchClientsDashboard(
        dieticianId,
        activeTab,
        page,
        formattedDate
      );

      const fetchedClients = res.clients || [];
      setClients(fetchedClients);
      dispatch(setSummary(res.summary || {}));

      setCache((prev) => ({
        ...prev,
        [cacheKey]: fetchedClients,
      }));
    } catch (error) {
      console.error("Error loading clients:", error);
    } finally {
      setLoading(false);
    }
  };

  const isValidSearch = search.trim().length >= 3;

  const displayClients =
    isValidSearch && searchResults !== null ? searchResults : clients;

  // Get total count based on active tab
  const getTotalCount = () => {
    switch (activeTab) {
      case "tested":
        return summary.tested_total || 0;
      case "missed":
        return summary.missed_total || 0;
      case "all":
      default:
        return summary.all_total || 0;
    }
  };

  const totalCount = getTotalCount();
  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));

  // Reset to page 1 if current page exceeds total pages (e.g., when switching tabs)
  useEffect(() => {
    if (page > totalPages) {
      setPage(1);
    }
  }, [totalPages, page]);

  // Pagination with ellipsis - scales well for many pages
  const getPageNumbers = () => {
    const maxVisible = 5;
    const pages = [];

    if (totalPages <= maxVisible + 2) {
      // Show all pages if total is small enough
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    // Always show first page
    pages.push(1);

    let start = Math.max(2, page - 1);
    let end = Math.min(totalPages - 1, page + 1);

    // Adjust window near start
    if (page <= 3) {
      start = 2;
      end = 4;
    }

    // Adjust window near end
    if (page >= totalPages - 2) {
      start = totalPages - 3;
      end = totalPages - 1;
    }

    // Add ellipsis after first page if needed
    if (start > 2) {
      pages.push("...");
    }

    // Add middle pages
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    // Add ellipsis before last page if needed
    if (end < totalPages - 1) {
      pages.push("...");
    }

    // Always show last page
    pages.push(totalPages);

    return pages;
  };

  const tabClass = (tabName) =>
    `px-4 xl:px-[30px] py-[11px] rounded-[20px] cursor-pointer transition-all duration-200 whitespace-nowrap ${
      activeTab === tabName ? "bg-[#252525]" : "border border-[#E1E6ED]"
    }`;

  const textClass = (tabName) =>
    `text-[12px] font-normal tracking-[-0.24px] whitespace-nowrap ${
      activeTab === tabName ? "text-white" : "text-[#A1A1A1]"
    }`;

  const changeTab = (tab) => {
    setActiveTab(tab);
    setPage(1);
    setSearch("");
    setSearchResults(null);
    setCache({});
  };

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-[15px] border-[#E1E6ED] rounded-[10px]">
        <div className="flex flex-wrap items-center justify-between gap-3 w-full">
          <div className="flex flex-wrap gap-2.5">
            <div className={tabClass("all")} onClick={() => changeTab("all")}>
              <p className={textClass("all")}>All ({summary.all_total})</p>
            </div>

            <div
              className={tabClass("tested")}
              onClick={() => changeTab("tested")}
            >
              <p className={textClass("tested")}>
                Tested ({summary.tested_total})
              </p>
            </div>

            <div
              className={tabClass("missed")}
              onClick={() => changeTab("missed")}
            >
              <p className={textClass("missed")}>
                Missed ({summary.missed_total})
              </p>
            </div>
          </div>

          <div className="flex-1 min-w-[220px] sm:max-w-[323px]">
            <UserProfile
              showOnlySearch={true}
              searchQuery={search}
              onSearchChange={setSearch}
              onSearchResults={handleSearchResults}
            />
          </div>
        </div>

        <div className="relative min-h-[200px]">
          <ClientTable
            clients={displayClients}
            search={search}
            onSearchChange={setSearch}
          />

          {(loading || (isValidSearch && searchResults === null)) && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
              <p className="text-gray-500 text-sm">
                {isValidSearch ? "Searching..." : "Loading..."}
              </p>
            </div>
          )}
        </div>

        {!search.trim() && totalCount > 0 && (
          <div className="flex justify-center items-center gap-2 py-5 flex-wrap">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className={`px-3 py-1 border rounded ${
                page === 1
                  ? "opacity-40 cursor-not-allowed"
                  : "cursor-pointer"
              }`}
            >
              Prev
            </button>

            {getPageNumbers().map((num, idx) => {
              if (num === "...") {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="px-3 py-1 text-[14px] text-[#535359]"
                  >
                    ...
                  </span>
                );
              }

              return (
                <button
                  key={num}
                  onClick={() => setPage(num)}
                  className={`px-3 py-1 text-[14px] border rounded ${
                    page === num
                      ? "bg-[#252525] text-white cursor-pointer"
                      : "text-[#535359] cursor-pointer"
                  }`}
                >
                  {num}
                </button>
              );
            })}

            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className={`px-3 py-1 border rounded ${
                page >= totalPages
                  ? "opacity-40 cursor-not-allowed"
                  : "cursor-pointer"
              }`}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}