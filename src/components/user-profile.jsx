

"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { IoIosArrowDown } from "react-icons/io";
import { cookieManager } from "../lib/cookies";
import PendingPopUp from "./modal/pending-popup";
import { searchClientsService } from "../services/authService";

export const UserProfile = ({
  searchQuery = "",
  onSearchChange = () => {},
  onSortChange = () => {},
  showOnlySearch = false,
  onSearchResults = null,
}) => {
  const pathname = usePathname();

  const isClientPage =
    pathname?.startsWith("/trainer/client") ||
    pathname?.startsWith("/trainer/clients");

  const isMessagesPage = pathname?.startsWith("/trainer/messages");

  const [dieticianName, setDieticianName] = useState("Dietician");
  const [currentDate, setCurrentDate] = useState("-");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState("Recently Added");
  const [pendingRequest, setPendingRequest] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  const debounceRef = useRef(null);

  const handleOptionSelect = (option) => {
    setSelectedOption(option);
    setIsOpen(false);
    onSortChange(option);
  };

  const handleSearch = async (searchTerm) => {
    if (!onSearchResults) return;

    const trimmedValue = searchTerm.trim();

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!trimmedValue) {
      setSearchLoading(false);
      onSearchResults(null);
      return;
    }

    if (trimmedValue.length < 3) {
      setSearchLoading(false);
      onSearchResults(null);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        setSearchLoading(true);

        const dieticianData = cookieManager.getJSON("dietician");
        const dieticianId = dieticianData?.dietician_id;

        if (!dieticianId) {
          console.error("Dietician ID not found");
          onSearchResults([]);
          return;
        }

        const response = await searchClientsService(dieticianId, trimmedValue);

        if (response?.status) {
          onSearchResults(response?.clients || []);
        } else {
          onSearchResults([]);
        }
      } catch (error) {
        console.error("Error searching clients:", error);
        onSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 500);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const dieticianData = cookieManager.getJSON("dietician");

    setDieticianName(dieticianData?.name || "Dietician");

    const date = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    setCurrentDate(date);
  }, []);

  const handleInputChange = (e) => {
    const value = e.target.value;
    onSearchChange(value);
    handleSearch(value);
  };

  const messageStyleSearch = (
    <div className="flex gap-[22px] w-full">
      <div className="flex gap-[15px] pl-[14px] pr-[14px] py-[10px] items-center rounded-[15px] bg-[#F5F7FA] w-full relative">
        <Image
          src="/icons/hugeicons_search-02.svg"
          alt="hugeicons_search"
          width={24}
          height={24}
        />
        <input
          type="text"
          placeholder="Search"
          className="flex-1 bg-transparent outline-none text-[#A1A1A1] text-[12px] font-normal leading-normal tracking-[-0.24px]"
          value={searchQuery}
          onChange={handleInputChange}
        />
        {searchLoading && searchQuery.trim().length >= 3 && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="flex w-full flex-wrap items-center justify-between gap-10">
        <div className="flex-1">
          {showOnlySearch ? (
            messageStyleSearch
          ) : isClientPage ? (
            <div className="flex gap-[22px] mt-[46px] mb-[32px]">
              <div className="flex gap-2.5 pl-2.5 pr-2.5 py-[5px] items-center border border-[#D9D9D9] rounded-[10px] bg-[#FFFFFF] w-[300px] relative">
                <Image
                  src="/icons/hugeicons_search-02.svg"
                  alt="hugeicons_search"
                  width={20}
                  height={20}
                />
                <input
                  type="text"
                  placeholder="Search...."
                  className="flex-1 text-[#252525] text-[12px] font-normal leading-[110%] tracking-[-0.24px] outline-none bg-transparent"
                  value={searchQuery}
                  onChange={handleInputChange}
                />
                {searchLoading && searchQuery.trim().length >= 3 && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
                  </div>
                )}
              </div>

              <div className="w-fit flex justify-center relative">
                <div className="rounded-l-[10px] border border-[#D9D9D9] pl-4 py-2 pr-2.5 bg-[#F0F0F0] text-center">
                  <p className="text-[#252525] text-[12px] tracking-[-0.24px] leading-[110%] font-normal">
                    Sort By
                  </p>
                </div>

                <div
                  className="flex rounded-r-[10px] border border-[#D9D9D9] gap-[37px] text-center items-center pl-4 py-2 pr-2.5 bg-white relative cursor-pointer"
                  onClick={() => setIsOpen(!isOpen)}
                >
                  <p className="text-[#252525] text-[12px] tracking-[-0.24px] leading-[110%] font-normal flex items-center gap-1">
                    {selectedOption}
                  </p>

                  <IoIosArrowDown
                    className={`text-[#A1A1A1] transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </div>

                {isOpen && (
                  <div className="absolute top-full right-0 mt-1 w-full bg-white border border-[#D9D9D9] rounded-[10px] shadow-lg z-10">
                    {[
                      "Recently Added",
                      "A to Z",
                      "Z to A",
                      "By Age Asc",
                      "By Age Desc",
                    ].map((option, index) => (
                      <div
                        key={option}
                        className={`px-4 py-2 text-[12px] tracking-[-0.24px] leading-[110%] font-normal cursor-pointer hover:bg-gray-50 ${
                          selectedOption === option
                            ? "text-[#308BF9] bg-blue-50"
                            : "text-[#252525]"
                        } ${
                          index === 0
                            ? "rounded-t-[10px]"
                            : index === 4
                            ? "rounded-b-[10px]"
                            : ""
                        }`}
                        onClick={() => handleOptionSelect(option)}
                      >
                        {option}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : isMessagesPage ? (
            messageStyleSearch
          ) : (
            <></>
          )}
        </div>
      </div>

      <PendingPopUp
        open={pendingRequest}
        onClose={() => setPendingRequest(false)}
      />
    </>
  );
};