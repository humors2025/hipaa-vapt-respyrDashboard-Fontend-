"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UserProfile } from "./user-profile";
import { toast } from "sonner";
import { selectClients, getClientsForDietician } from "../store/clientSlice";
import { useDispatch, useSelector } from "react-redux";
import { resolveProfileImage } from "../lib/profileImage";

export default function ClientTable({
  showUserProfile = true,
  showDailyStatusHeader = true,
  showTestTaken = false,
  testAssigned = false,
  clients: clientsList,
  activeTab = "all",
  search: externalSearch = "", // Add prop to receive search from parent
  onSearchChange = null, // Add prop to handle search changes
}) {
  const [internalSearch, setInternalSearch] = useState("");
  const [sortOption, setSortOption] = useState("Recently Added");
  const router = useRouter();

  // Use external search if provided, otherwise use internal
  const search = externalSearch !== undefined ? externalSearch : internalSearch;
  const handleSearchChange = onSearchChange || setInternalSearch;

  // Handle sort change from UserProfile
  const handleSortChange = (option) => {
    setSortOption(option);
  };

  // Helper function to format date
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch (error) {
      return "N/A";
    }
  };

  // Helper function to determine plan status
  const getPlanStatus = (plansCount) => {
    if (!plansCount) return "No Plan";
    return plansCount.active > 0 ? "Active" : "Inactive";
  };

  // Helper function to get the most relevant plan
  const getMostRelevantPlan = (client) => {
    if (!client.plans_summary) return null;

    const allPlans = [
      ...(client.plans_summary.active || []),
      ...(client.plans_summary.not_started || []),
      ...(client.plans_summary.completed || []),
    ];

    if (allPlans.length === 0) return null;

    const sortedPlans = allPlans.sort(
      (a, b) =>
        new Date(b.plan_start_date || 0) - new Date(a.plan_start_date || 0)
    );

    const activePlans = client.plans_summary.active || [];
    if (activePlans.length > 0) {
      return activePlans.sort(
        (a, b) =>
          new Date(b.plan_start_date || 0) - new Date(a.plan_start_date || 0)
      )[0];
    }

    const notStartedPlans = client.plans_summary.not_started || [];
    if (notStartedPlans.length > 0) {
      return notStartedPlans.sort(
        (a, b) =>
          new Date(b.plan_start_date || 0) - new Date(a.plan_start_date || 0)
      )[0];
    }

    return sortedPlans[0];
  };

  // Helper function to calculate plan duration and type
  const getPlanType = (activePlan) => {
    if (!activePlan) return "No plan";

    const startDate = activePlan.plan_start_date;
    const endDate = activePlan.plan_end_date;

    if (!startDate || !endDate) return "Custom plan";

    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const timeDiff = end.getTime() - start.getTime();
      const dayDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;

      if (dayDiff <= 0) return "Invalid dates";

      const months = Math.floor(dayDiff / 30);
      const days = dayDiff % 30;

      if (months > 0) {
        return days > 0
          ? `${months}-month ${days}-day plan`
          : `${months}-month plan`;
      } else {
        return `${dayDiff}-day plan`;
      }
    } catch (error) {
      return "Custom plan";
    }
  };


  // Helper function to format last tested text
// The API tags last_logged_date with "Z" (UTC) but the value is actually
// server local wall-clock time (p_created has no timezone at all). Parsing it
// as UTC shifts it into the future, so we read the wall-clock components and
// build a local Date instead of trusting the "Z".
const parseServerDate = (dateString) => {
  const m = String(dateString).match(
    /(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/
  );
  if (!m) return new Date(dateString);
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
};

const formatLastLoggedDate = (dateString) => {
  if (!dateString) return "No test yet";

  try {
    const testDate = parseServerDate(dateString);
    const now = new Date();

    if (isNaN(testDate.getTime())) return "No test yet";

    // Clamp small negative diffs (clock skew) to 0.
    const diffMs = Math.max(0, now - testDate);
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 24) {
      if (diffMinutes < 1) return "Last tested just now";
      if (diffMinutes < 60) return `Last tested ${diffMinutes} min${diffMinutes > 1 ? "s" : ""} ago`;
      return `Last tested ${diffHours} hr${diffHours > 1 ? "s" : ""} ago`;
    }

    return testDate.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch (error) {
    return "No test yet";
  }
};


  const transformClientData = (apiData) => {
    if (!apiData || !Array.isArray(apiData)) return [];

    return apiData.map((client) => ({
      name: client.client_name || client.name || "N/A",
      age: client.age || "N/A",
      gender: client.gender || "N/A",

      displayAge: `${client.age || "N/A"} years, ${client.gender || "N/A"}`,

      // Date
      dateCreated: client.p_created
        ? client.p_created.split(" ")[0]
        : "No date",
      rawDate: client.last_logged_date || client.joined_dttm || null,

      referenceCode: client.profile_id,

      // Fitness goal
      fitness_goal: client.fitness_goal_display || "-",

      // Metabolism
      metabolism_score:
        client.metabolism_score !== null && !isNaN(client.metabolism_score)
          ? `${Number(client.metabolism_score).toFixed(0)}%`
          : "No test",

      // Last test
      last_logged: formatLastLoggedDate(client.last_logged_date),

      // Level type
      level_type: client.level_type ?? "N/A",

      // Diet plan generated
      diet_plan_generated_date: client.diet_plan_generated_date || null,

      image: resolveProfileImage(client.p_image),

      dieticianId: client.dietician_id,
      profileId: client.profile_id,
      phone: client.phone,
      dob: client.dob,
      joined_dttm: client.joined_dttm,
    }));
  };

  // Filter data based on activeTab
  let filteredByTab = clientsList;
  if (activeTab === "active") {
    filteredByTab = clientsList.filter((c) => (c?.plans_count?.active ?? 0) > 0);
  } else if (activeTab === "needs") {
    filteredByTab = clientsList.filter((c) => (c?.plans_count?.total ?? 0) === 0);
  }

  const clients = useMemo(
    () => transformClientData(filteredByTab),
    [filteredByTab]
  );

  // Sort clients based on selected option (NO LOCAL SEARCH FILTERING)
  const sortedClients = useMemo(() => {
    if (!clients.length) return [];

    const clientsCopy = [...clients];

    switch (sortOption) {
      case "Recently Added":
        return clientsCopy.sort((a, b) => {
          if (!a.rawDate && !b.rawDate) return 0;
          if (!a.rawDate) return 1;
          if (!b.rawDate) return -1;
          return new Date(b.rawDate) - new Date(a.rawDate);
        });

      case "A to Z":
        return clientsCopy.sort((a, b) => a.name.localeCompare(b.name));

      case "Z to A":
        return clientsCopy.sort((a, b) => b.name.localeCompare(a.name));

      case "By Age Asc":
        return clientsCopy.sort((a, b) => {
          const ageA = parseInt(a.age, 10);
          const ageB = parseInt(b.age, 10);

          if (isNaN(ageA) && isNaN(ageB)) return 0;
          if (isNaN(ageA)) return 1;
          if (isNaN(ageB)) return -1;

          return ageA - ageB;
        });

      case "By Age Desc":
        return clientsCopy.sort((a, b) => {
          const ageA = parseInt(a.age, 10);
          const ageB = parseInt(b.age, 10);

          if (isNaN(ageA) && isNaN(ageB)) return 0;
          if (isNaN(ageA)) return 1;
          if (isNaN(ageB)) return -1;

          return ageB - ageA;
        });

      default:
        return clientsCopy;
    }
  }, [clients, sortOption]);

  // NO LOCAL SEARCH FILTERING - use sortedClients directly
  const filteredClients = sortedClients;

  const copyToClipboard = (text) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast.success("Reference code copied!");
      })
      .catch((err) => {
        toast.error("Failed to copy reference code");
        console.error("Failed to copy: ", err);
      });
  };

  const handleRowClick = (client) => {
    const params = new URLSearchParams({
      profile_id: client.profileId,
    });
    router.push(`/trainer/clients-profile?${params.toString()}`);
  };

  return (
    <>
      {/* Pass the sort handler to UserProfile */}
      {/* {showUserProfile && (
        <div className="">
          <UserProfile
            searchQuery={search}
            onSearchChange={handleSearchChange}
            onSortChange={handleSortChange}
            showOnlySearch={true}
          />
        </div>
      )} */}

      <div>
        <div className="rounded-[15px] overflow-hidden h-[calc(100vh-290px)] ">
          <div className="h-full overflow-y-auto overflow-x-auto group-hover-scrollbar">
            <table className="w-full min-w-[640px] lg:min-w-0 bg-[#FFFFFF] border-collapse relative">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#F0F0F0]">
                  <th className="px-2.5 xl:px-[15px] py-5 text-left rounded-tl-[15px]">
                    <p className="text-[#535359] font-normal text-xs leading-[1.1] tracking-[-0.24px] font-['Poppins']">
                      Client Name {sortOption === "A to Z" && "↑"}{" "}
                      {sortOption === "Z to A" && "↓"}
                    </p>
                  </th>
                  <th className="px-2.5 xl:px-[15px] py-5 text-center">
                    <p className="text-[#535359] font-normal text-xs leading-[1.1] tracking-[-0.24px] font-['Poppins']">
                      Date Created {sortOption === "Recently Added" && "↓"}
                    </p>
                  </th>
                  <th className="px-2.5 xl:px-[15px] py-5 text-center">
                    <p className="text-[#535359] font-normal text-xs leading-[1.1] tracking-[-0.24px] font-['Poppins']">
                      Fitness Goal
                    </p>
                  </th>
                  <th className="px-2.5 xl:px-[15px] py-5 text-center">
                    <p className="text-[#535359] font-normal text-xs leading-[1.1] tracking-[-0.24px] font-['Poppins']">
                      Metabolism Score
                    </p>
                  </th>
                  <th className="px-2.5 xl:px-[15px] py-5 text-center">
                    <p className="text-[#535359] font-normal text-xs leading-[1.1] tracking-[-0.24px] font-['Poppins']">
                      Level
                    </p>
                  </th>

                  <th className="px-2.5 xl:px-[15px] py-5 text-center">
                    <p className="text-[#535359] font-normal text-xs leading-[1.1] tracking-[-0.24px] font-['Poppins']">
                      Diet Plan
                    </p>
                  </th>

                  <th className="px-2.5 xl:px-[15px] py-5 text-center rounded-tr-[15px]">
                    <p className="text-[#535359] font-normal text-xs leading-[1.1] tracking-[-0.24px] font-['Poppins']">
                      Last Tested
                    </p>
                  </th>

                  {showTestTaken && (
                    <th className="px-2.5 xl:px-[15px] py-5 text-left">
                      <p className="text-[#535359] text-center font-normal text-xs leading-[1.1] tracking-[-0.24px] font-['Poppins']">
                        Test Taken
                      </p>
                    </th>
                  )}

                  {testAssigned && (
                    <th className="px-2.5 xl:px-[15px] py-5 text-left">
                      <p className="text-[#535359] text-center font-normal text-xs leading-[1.1] tracking-[-0.24px] font-['Poppins']">
                        Test Assigned
                      </p>
                    </th>
                  )}

                  <th className="px-2.5 xl:px-[15px] py-5 text-left hidden">
                    <p className="text-[#535359] font-normal text-xs leading-[1.1] tracking-[-0.24px] font-['Poppins']">
                      Actions
                    </p>
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-2.5 xl:px-[15px] py-8 text-center">
                      <p className="text-[#A1A1A1] text-[18px]">
                        No clients found.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredClients.map((client, idx) => (
                    <tr
                      key={`${client.profileId}-${idx}`}
                      className="border-b border-[#D9D9D9] align-top cursor-pointer [&>td]:cursor-pointer hover:bg-gray-50"
                      onClick={() => handleRowClick(client)}
                    >
                      {/* Client Name */}
                      <td className="px-2.5 xl:px-[15px] py-5">
                        <div className="flex gap-2 xl:gap-[15px]">
                          <div className="relative h-8 w-8 rounded-full overflow-hidden bg-[#F0F0F0]">
                            <Image
                              // src={
                              //   client.image || "/icons/hugeicons_user-circle-02.svg"
                              // }
                               src="/icons/hugeicons_user-circle-02.svg"
                           
                              alt={client.name || "profile"}
                              fill
                              unoptimized
                              className="object-cover"
                              sizes="32px"
                              priority={false}
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-[#252525] text-[12px] font-semibold leading-[126%] tracking-[-0.24px]">
                              {client.name}
                            </span>
                            <span className="font-normal text-[10px] leading-normal tracking-[-0.2px]">
                              {client.displayAge}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Date Created */}
                      <td className="px-2.5 xl:px-[15px] py-5 text-center">
                        <span className="text-[#A1A1A1] text-[12px] font-normal leading-[126%] tracking-[-0.24px]">
                          {client.dateCreated}
                        </span>
                      </td>

                      <td className="px-2.5 xl:px-[15px] py-5 text-center">
                        <span className="text-[#A1A1A1] text-[12px] font-normal leading-[126%] tracking-[-0.24px]">
                          {client.fitness_goal}
                        </span>
                      </td>

                      <td className="px-2.5 xl:px-[15px] py-5 text-center">
                        <span className="text-[#A1A1A1] text-[12px] font-normal leading-[126%] tracking-[-0.24px]">
                          {client.metabolism_score}
                        </span>
                      </td>

                      {/* Level */}
                      <td className="px-2.5 xl:px-[15px] py-5 text-center">
                        <span className="text-[#A1A1A1] text-[12px] font-normal leading-[126%] tracking-[-0.24px]">
                          {client.level_type}
                        </span>
                      </td>

                      {/* Diet Plan */}
                      <td className="px-2.5 xl:px-[15px] py-5 text-center">
                        {client.diet_plan_generated_date ? (
                          <span className="text-[#252525] text-[12px] font-normal leading-[126%] tracking-[-0.24px]">
                            Yes,{" "}
                            <span className="text-[#A1A1A1]">
                              {client.diet_plan_generated_date}
                            </span>
                          </span>
                        ) : (
                          <span className="text-[#A1A1A1] text-[12px] font-normal leading-[126%] tracking-[-0.24px]">
                            No
                          </span>
                        )}
                      </td>

                      {/* Last Tested */}
                      <td className="px-2.5 xl:px-[15px] py-5 text-center">
                        <span className="text-[#A1A1A1] text-[12px] font-normal leading-[126%] tracking-[-0.24px]">
                          {client.last_logged}
                        </span>
                      </td>

                      {/* Test Count */}
                      {showTestTaken && (
                        <td className="text-center px-2.5 xl:px-[15px] py-5">
                          <span className="text-[#252525] text-center text-[12px] font-semibold leading-[1.26px]">
                            {client.plansCompleted}
                          </span>
                        </td>
                      )}

                      {testAssigned && (
                        <td className="text-center px-2.5 xl:px-[15px] py-5">
                          <span className="text-[#252525] text-center text-[12px] font-semibold leading-[1.26px]">
                            {client.testAssigned}
                          </span>
                        </td>
                      )}

                      {/* Actions */}
                      <td className="px-2.5 xl:px-[15px] py-5 hidden">
                        <div className="py-2.5 flex gap-5">
                          <Image
                            src="/icons/hugeicons_message-02.svg"
                            alt="message"
                            width={20}
                            height={20}
                            className="cursor-pointer"
                          />
                          <Image
                            src="/icons/hugeicons_view.svg"
                            alt="view"
                            width={20}
                            height={20}
                            className="cursor-pointer"
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}