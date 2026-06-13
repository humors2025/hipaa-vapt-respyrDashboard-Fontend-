

"use client"
import Image from "next/image";
import { IoIosArrowForward } from "react-icons/io";
import { useSelector } from "react-redux";
import { selectClients } from "../store/clientSlice";
import { cookieManager } from "../lib/cookies";
import { fetchDashboardTableCards } from "../services/authService";
import { useEffect, useState } from "react";

export default function DashboardCard({ activeTab }) {
  const clients = useSelector(selectClients);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Get dietician data from cookies
  const dieticianData = cookieManager.getJSON('dietician');
  const dieticianId = dieticianData?.dietician_id;

  // Fetch dashboard data when component mounts and when activeTab changes to Test Monitor
  useEffect(() => {
    if (activeTab === "Test Monitor" && dieticianId) {
      fetchDashboardData();
    }
  }, [activeTab, dieticianId]);

  const fetchDashboardData = async () => {
    if (!dieticianId) return;
    
    setLoading(true);
    try {
      const response = await fetchDashboardTableCards(dieticianId);
      if (response.success) {
        setDashboardData(response.summary);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate metrics from clients data
  const calculateClientMetrics = () => {
    if (!clients || !Array.isArray(clients)) {
      return {
        totalClients: 0,
        activePlans: 0,
        needsPlan: 0
      };
    }

    const totalClients = clients.length;
    
    const activePlans = clients.reduce((count, client) => {
      return count + (client.plans_count?.active || 0);
    }, 0);
    
    const needsPlan = clients.reduce((count, client) => {
      // Clients with no active plans and no plans at all
      const hasNoActivePlans = (client.plans_count?.active || 0) === 0;
      const hasNoPlans = (client.plans_count?.total || 0) === 0;
      return count + (hasNoActivePlans ? 1 : 0);
    }, 0);

    return {
      totalClients,
      activePlans,
      needsPlan
    };
  };

  const metrics = calculateClientMetrics();

  if (activeTab === "Client Monitor") {
    return (
      <div className="flex gap-5 hidden">
        {/* Total Client Card */}
        <div className="w-full flex flex-col gap-10 bg-white border border-[#E1E6ED] rounded-[10px] pt-5 pl-5 pb-8">
          <span className="text-[#252525] text-[12px] font-semibold leading-[126%] tracking-[-0.24px] whitespace-nowrap">
            Total Client
          </span>
          <span className="text-[#252525] text-[40px] font-bold leading-normal tracking-[-0.8px]">
            {metrics.totalClients}
          </span>
        </div>

        {/* Active Plans Card */}
        <div className="w-full flex flex-col gap-10 bg-[#F5F7FA] border border-[#E1E6ED] rounded-[10px] pt-5 pl-5 pb-8 ">
          <span className="text-[#252525] text-[12px] font-semibold leading-[126%] tracking-[-0.24px] whitespace-nowrap">
            Active Plans
          </span>
          <span className="text-[#252525] text-[40px] font-bold leading-normal tracking-[-0.8px]">
            {metrics.activePlans}
          </span>
        </div>

        {/* Needs Plan Card */}
        <div className="w-full flex flex-col gap-10 bg-[#F5F7FA] border border-[#E1E6ED] rounded-[10px] pt-5 pl-5 pb-8 pr-5 ">
          <div className="flex gap-[119px] items-center">
            <span className="text-[#252525] text-[12px] font-semibold leading-[126%] tracking-[-0.24px] whitespace-nowrap">
              Needs Plan
            </span>
            {/* <div className="flex gap-2.5">
              <span className="text-[#308BF9] text-[12px] font-semibold leading-[110%] tracking-[-0.24px] whitespace-nowrap">
                Give Plans
              </span>
              <IoIosArrowForward className="text-[#308BF9]" />
            </div> */}
          </div>
          <span className="text-[#252525] text-[40px] font-bold leading-normal tracking-[-0.8px]">
            {metrics.needsPlan}
          </span>
        </div>
      </div>
    );
  }

  if (activeTab === "Test Monitor") {
    return (
      <div className="flex gap-5 hidden">
        <div className="flex flex-col gap-10 bg-white border border-[#E1E6ED] rounded-[10px] pt-5 pl-5 pb-8 w-full">
          <span className="text-[#252525] text-[12px] font-semibold leading-[126%] tracking-[-0.24px] whitespace-nowrap">
            Total Tests purchased
          </span>
          <span className="text-[#252525] text-[40px] font-bold leading-normal tracking-[-0.8px]">
            {loading ? "..." : (dashboardData?.total_tests_purchased || 0)}
          </span>
        </div>

        <div className="flex flex-col gap-10 bg-white border border-[#E1E6ED] rounded-[10px] pt-5 pl-5 pb-8 w-full">
          <span className="text-[#252525] text-[12px] font-semibold leading-[126%] tracking-[-0.24px] whitespace-nowrap">
            Tests Assigned
          </span>
          <span className="text-[#252525] text-[40px] font-bold leading-normal tracking-[-0.8px]">
            {loading ? "..." : (dashboardData?.total_tests_used || 0)}
          </span>
        </div>

        <div className="w-full flex flex-col gap-10 bg-[#F5F7FA] border border-[#E1E6ED] rounded-[10px] pt-5 pl-5 pb-8 ">
          <div className="flex gap-[58px] items-center">
            <span className="text-[#252525] text-[12px] font-semibold leading-[126%] tracking-[-0.24px] whitespace-nowrap">
              Tests Remaining
            </span>
            {/* <div className="flex gap-2.5">
              <span className="text-[#308BF9] text-[12px] font-semibold leading-[110%] tracking-[-0.24px] whitespace-nowrap">
                Purchase more
              </span>
              <IoIosArrowForward className="text-[#308BF9]" />
            </div> */}
          </div>
          <span className="text-[#252525] text-[40px] font-bold leading-normal tracking-[-0.8px]">
            {loading ? "..." : (dashboardData?.remaining_tests || 0)}
          </span>
        </div>
      </div>
    );
  }

  if (activeTab === "Diet Plan Monitor") {
    return (
      <div className="flex gap-5">
        <div className="flex flex-col gap-10 bg-white border border-[#E1E6ED] rounded-[10px] pt-5 pl-5 pb-8 pr-[238px]">
          <span className="text-[#252525] text-[12px] font-semibold leading-[126%] tracking-[-0.24px] whitespace-nowrap">
            Client Tracked
          </span>
          <span className="text-[#252525] text-[40px] font-bold leading-normal tracking-[-0.8px]">45</span>
        </div>

        <div className="flex flex-col gap-10 bg-white border border-[#E1E6ED] rounded-[10px] pt-5 pl-5 pb-8 pr-[238px]">
          <div className="flex gap-[5px]">
            <Image src="/icons/hugeicons_liver14.svg" alt="hugeicons_liver14.svg" width={18} height={18} />
            <span className="text-[#252525] text-[12px] font-semibold leading-[126%] tracking-[-0.24px] whitespace-nowrap">
              Clients Followed
            </span>
          </div>
          <span className="text-[#252525] text-[40px] font-bold leading-normal tracking-[-0.8px]">5</span>
        </div>

        <div className="flex flex-col gap-10 bg-[#F5F7FA] border border-[#E1E6ED] rounded-[10px] pt-5 pl-5 pb-8 pr-[238px]">
          <div className="flex gap-[119px]">
            <div className="flex gap-[5px]">
              <Image src="/icons/hugeicons_24liver.svg" alt="hugeicons_24liver.svg" width={18} height={18} />
              <span className="text-[#252525] text-[12px] font-semibold leading-[126%] tracking-[-0.24px] whitespace-nowrap">
                Clients Not Followed
              </span>
            </div>
            <div className="flex gap-2.5">
              <span className="text-[#308BF9] text-[12px] font-semibold leading-[110%] tracking-[-0.24px] whitespace-nowrap">
                Send Message
              </span>
              <IoIosArrowForward className="text-[#308BF9]" />
            </div>
          </div>
          <span className="text-[#252525] text-[40px] font-bold leading-normal tracking-[-0.8px]">20</span>
        </div>
      </div>
    );
  }

  
  return null;
}