"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import EditRightSideBar from "./edit-rightsidebar";
import { getClientProfileDetails } from "../services/authService"; // Import the new service function
import { cookieManager } from "../lib/cookies"; // Import cookie manager
import { usePathname } from "next/navigation"; // For getting profile_id from URL
import { resolveProfileImage } from "../lib/profileImage";

export default function RightSidebar({ isOpen, onClose, profileId, dietitianId }) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [clientData, setClientData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const pathname = usePathname();

  // Level styles mapping
  const levelStyles = {
    1: {
      textColor: '#006FFF',
      bgColor: '#E9F3FF'
    },
    2: {
      textColor: '#F6AD0B',
      bgColor: '#FFFAF0'
    },
    3: {
      textColor: '#3FAF58',
      bgColor: '#EAFFEF'
    }
  };

  // Get current level styles (with fallback to level 1)
  const currentLevelStyles = levelStyles[currentLevel] || levelStyles[1];

  // Get dietitian_id from cookies
  const getDietitianId = () => {
    const dieticianCookie = cookieManager.get("dietician");
    if (dieticianCookie) {
      try {
        const parsedData = JSON.parse(decodeURIComponent(dieticianCookie));
        return parsedData.dietician_id;
      } catch (error) {
        console.error("Error parsing dietician cookie:", error);
        return null;
      }
    }
    return null;
  };

  // Get profile_id from URL
  const getProfileIdFromUrl = () => {
    const pathSegments = pathname.split("/");
    const profileIndex = pathSegments.findIndex(segment => segment === "profile");
    if (profileIndex !== -1 && pathSegments[profileIndex + 1]) {
      return pathSegments[profileIndex + 1];
    }
    return null;
  };

  // Fetch client data when sidebar opens
  useEffect(() => {
    if (isOpen) {
      const dietitianIdFromCookie = getDietitianId();
      const profileIdFromUrl = getProfileIdFromUrl();
      
      // Use provided IDs or fall back to cookie/URL
      const finalDietitianId = dietitianId || dietitianIdFromCookie;
      const finalProfileId = profileId || profileIdFromUrl;
      
      if (finalDietitianId && finalProfileId) {
        fetchClientData(finalProfileId, finalDietitianId);
      }
    }
  }, [isOpen, dietitianId, profileId, pathname]);

  const fetchClientData = async (profileId, dietitianId) => {
    setIsLoading(true);
    try {
   
      const response = await getClientProfileDetails(profileId, dietitianId);
   
      if (response.status && response.data) {
        setClientData(response.data);
        setCurrentLevel(parseInt(response.data.level_type) || 1);
      }
    } catch (error) {
      console.error("Error fetching client data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLevelUpdate = (newLevel) => {
    setCurrentLevel(newLevel);
  };

  // Handle closing the entire sidebar (both main and edit)
  const handleCloseAll = () => {
    setIsEditOpen(false); // Close edit sidebar first
    onClose(); // Then close main sidebar
  };

  return (
    <>
      <div
        className={`absolute top-0 right-0 h-full z-50 flex items-start gap-3 transition-all duration-300 ${
          isOpen
            ? "translate-x-0 opacity-100 pointer-events-auto"
            : "translate-x-full opacity-0 pointer-events-none"
        }`}
      >
        {/* Outside Close Button - Now closes everything */}
        <button
          type="button"
          onClick={handleCloseAll}
          className="mt-4 cursor-pointer text-black bg-white border border-[#E1E6ED] rounded-full w-10 h-10 flex items-center justify-center shadow-sm z-50"
        >
          X
        </button>

        {/* Sidebar */}
        <div className="h-full bg-white rounded-r-[15px] border border-[#E1E6ED] shadow-sm overflow-hidden z-50">
          <div className="h-full flex flex-col gap-4">
            <div className="flex items-center justify-between pl-5 pt-[27px] pr-5">
              <p className="text-[#252525] text-[15px] font-semibold leading-[110%] tracking-[-0.3px]">
                Client Details
              </p>
            </div>

            <div className="flex-1 overflow-y-auto group-hover-scrollbar">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500">Loading client data...</p>
                </div>
              ) : clientData ? (
                <div className="flex flex-col">
                  {/* Client Profile Section */}
                  <div className="flex gap-5 rounded-[10px] py-7 pl-[15px] pr-14 mb-[30px] mx-[15px] bg-[#F5F7FA]">
                    <div className="w-[80px] h-[80px] bg-white rounded-full flex items-center justify-center">
                      <Image
                        src={resolveProfileImage(clientData.p_image)}
                        alt="Profile"
                        width={64}
                        height={64}
                        unoptimized
                        className="cursor-pointer rounded-full object-cover w-full h-full"
                        onError={(imageError) => {
                          imageError.target.src = "/icons/hugeicons_user-circle-02.svg";
                        }}
                      />
                    </div>
                    <div className="flex flex-col gap-[18px] py-1">
                      <p className="text-[#252525] text-[20px] font-semibold leading-[110%] tracking-[-0.4px]">
                        {clientData.client_name}
                      </p>

                      <div>
                        <div className="flex gap-1.5 items-center">
                          <p className="text-[#535359] text-[12px] font-normal leading-normal tracking-[-0.24px]">
                            {clientData.phone_no !== "NA" ? clientData.phone_no : "Phone not available"}
                          </p>
                          <Image
                            src="/icons/Ellipse 765.svg"
                            alt="separator"
                            width={3}
                            height={3}
                          />
                          <p className="text-[#535359] text-[12px] font-normal leading-normal tracking-[-0.24px]">
                            {clientData.email !== "NA" ? clientData.email : "Email not available"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    {/* Personal Info */}
                    <div className="flex justify-between px-5 pt-6 pb-9 border-t border-b border-[#E1E6ED]">
                      <div className="flex flex-col gap-[15px]">
                        <p className="text-[#252525] text-[12px] font-normal leading-normal tracking-[-0.24px]">
                          Personal Info
                        </p>
                        <p className="text-[#252525] text-[15px] font-semibold leading-[110%] tracking-[-0.3px]">
                          {`${clientData.gender}, ${clientData.age} years, ${clientData.height} cm, ${clientData.weight} kg`}
                        </p>
                      </div>
                    </div> 

                    {/* Performance Level */}
                    <div className="flex justify-between px-5 pt-6 pb-9 border-t border-b border-[#E1E6ED]">
                      <div className="flex flex-col gap-[15px]">
                        <p className="text-[#252525] text-[12px] font-normal leading-normal tracking-[-0.24px]">
                          Performance Level
                        </p>
                        <div 
                          className="rounded-[5px] px-2.5 py-2"
                          style={{ 
                            width: '68px',
                            backgroundColor: currentLevelStyles.bgColor 
                          }}
                        >
                          <p 
                            className="text-[15px] font-semibold leading-[126%] tracking-[-0.3px] whitespace-nowrap"
                            style={{ color: currentLevelStyles.textColor }}
                          >
                            LEVEL {currentLevel}
                          </p>
                        </div>
                      </div>

                      <Image
                        src="/icons/hugeicons_edit-0466.svg"
                        alt="Edit"
                        width={24}
                        height={24}
                        className="cursor-pointer"
                        onClick={() => setIsEditOpen(true)}
                      />
                    </div>

                    {/* Fitness Goal */}
                    <div className="flex justify-between px-5 pt-6 pb-9 border-t border-b border-[#E1E6ED]">
                      <div className="flex flex-col gap-[15px]">
                        <p className="text-[#252525] text-[12px] font-normal leading-normal tracking-[-0.24px]">
                          Fitness Goal
                        </p>
                        <p className="text-[#252525] text-[15px] font-semibold leading-[110%] tracking-[-0.3px]">
                          {clientData.fitness_goal_display || clientData.fitness_goal}
                        </p>
                      </div>
                    </div>

                    {/* Activity Level */}
                    <div className="flex justify-between px-5 pt-6 pb-9 border-t border-b border-[#E1E6ED]">
                      <div className="flex flex-col gap-[15px]">
                        <p className="text-[#535359] text-[12px] font-normal leading-[110%] tracking-[-0.24px]">
                          Activity Level
                        </p>
                        <div className="flex flex-col gap-2.5">
                          <p className="text-[#252525] text-[15px] font-semibold leading-[110%] tracking-[-0.3px]">
                            {clientData?.activity_level}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Dietary Preferences */}
                    <div className="flex justify-between px-5 pt-6 pb-9 border-t border-b border-[#E1E6ED]">
                      <div className="flex flex-col gap-[15px]">
                        <p className="text-[#252525] text-[12px] font-normal leading-normal tracking-[-0.24px]">
                          Dietary Preferences
                        </p>
                       <p className="text-[#252525] text-[15px] font-semibold leading-[110%] tracking-[-0.3px]">
                            {clientData?.diet_type}
                          </p>
                      </div>
                    </div>


                  <div className="flex justify-between px-5 pt-6 pb-9 border-t border-b border-[#E1E6ED]">
  <div className="flex flex-col gap-[15px]">
    <p className="text-[#252525] text-[12px] font-normal leading-normal tracking-[-0.24px]">
      Cuisine Preferences
    </p>
    <p className="text-[#252525] text-[15px] font-semibold leading-[110%] tracking-[-0.3px]">
      {clientData.primary_cuisine}, {clientData.secondary_cuisine}
    </p>
  </div>
</div>



                    {/* Location/Region */}
                    <div className="flex justify-between px-5 pt-6 pb-9 border-t border-b border-[#E1E6ED]">
                      <div className="flex flex-col gap-[15px]">
                        <p className="text-[#252525] text-[12px] font-normal leading-normal tracking-[-0.24px]">
                          Location
                        </p>
                        <div className="flex items-center gap-2.5">
                          <p className="text-[#252525] text-[15px] font-semibold leading-[110%] tracking-[-0.3px]">
                            {clientData.region && clientData.region !== "NA" ? clientData.region : "Not specified"}
                            {clientData.location && clientData.location !== "NA" && clientData.location !== clientData.region 
                              ? `, ${clientData.location}` 
                              : ""}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500">No client data available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {isEditOpen && (
        <div className="absolute top-0 right-0 z-[60] h-full w-[465px] bg-white rounded-r-[15px]">
          <EditRightSideBar 
            onClose={() => setIsEditOpen(false)}
            currentLevel={currentLevel}  
            onLevelUpdate={handleLevelUpdate}  
            profileId={profileId || getProfileIdFromUrl()}
            dietitianId={dietitianId || getDietitianId()}
            clientData={clientData}
          />
        </div>
      )}
    </>
  );
}