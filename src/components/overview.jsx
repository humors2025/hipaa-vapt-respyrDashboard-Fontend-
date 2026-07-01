"use client";
import { useEffect } from "react";
import Progress from "./progress";
import { useDispatch, useSelector } from "react-redux";
import { getHabitMonitoringData } from "../store/habitMonitoringSlice"; 

export default function Overview({ profileId, dietitianId }) {
    const dispatch = useDispatch();
  const { loading, response, data, habitList, error } = useSelector(
    (state) => state.habitMonitoring
  );


     useEffect(() => {
        if (profileId && dietitianId) {
            dispatch(getHabitMonitoringData({ profileId, dietitianId }));
        }
    }, [dispatch, profileId, dietitianId]);

const habitData = response?.data;
// The API returns the overview stats (total_days_tracked, tracking_rate,
// completion_rate, total_perfect_days) at the top level of `data`.
// Fall back to a nested `summary` object for backwards compatibility.
const summary = habitData?.summary ?? habitData;

    return (
        <>
            <div className="flex flex-col gap-[15px] bg-[#F5F7FA] rounded-[15px] pt-5 pl-[18px] pr-[18px] pb-[18px]">
                <span className="pl-[3px] text-[#738298] text-[12px] font-semibold leading-normal tracking-[-0.24px] uppercase">
                    Overview
                </span>

                <div className="flex flex-col gap-5">
                    <div className="bg-[#E1E6ED] rounded-[20px] p-2.5 ">
                        <div className="grid grid-cols-2">
                            <div className="flex flex-col gap-5 pt-2 pb-[19px] pl-5 pr-5 border-r border-[#FFFFFF]">
                                <p className="text-[#535359] text-[10px] font-semibold leading-[110%] tracking-[-0.2px] capitalize">
                                    Days Tracked
                                </p>

                                <p className="text-[#252525]">
                                    <span className="text-[40px] font-normal leading-normal tracking-[-0.8px]">
                                        {summary?.total_days_tracked ?? "N/A"}
                                    </span>
                                    <span className="text-[10px] font-normal leading-[110%] tracking-[-0.2px] ml-1">
                                        Days
                                    </span>
                                </p>
                            </div>

                            <div className="flex flex-col gap-5 pt-2 pb-[19px] pl-8 pr-5">
                                <p className="text-[#535359] text-[10px] font-semibold leading-[110%] tracking-[-0.2px] capitalize">
                                    Tracking Rate
                                </p>

                                <p className="text-[#252525]">
                                    <span className="text-[40px] font-normal leading-normal tracking-[-0.8px]">
                                       {summary?.tracking_rate ?? "N/A"}
                                    </span>
                                    <span className="text-[10px] font-normal leading-[110%] tracking-[-0.2px] ml-1">
                                        %
                                    </span>
                                </p>
                            </div>

                            <div className="flex flex-col gap-5 pt-5 pb-[19px] pl-5 pr-5 border-t border-r border-[#FFFFFF]">
                                <p className="text-[#535359] text-[10px] font-semibold leading-[110%] tracking-[-0.2px] capitalize">
                                    Completion Rate
                                </p>

                                <p className="text-[#252525]">
                                    <span className="text-[40px] font-normal leading-normal tracking-[-0.8px]">
                                        {habitData?.week_summary?.completion_rate != null
                                            ? Math.round(habitData.week_summary.completion_rate)
                                            : "N/A"}
                                    </span>
                                    <span className="text-[10px] font-normal leading-[110%] tracking-[-0.2px] ml-1">
                                        %
                                    </span>
                                </p>
                            </div>

                            <div className="flex flex-col gap-5 pt-5 pb-[19px] pl-8 pr-5 border-t border-[#FFFFFF]">
                                <p className="text-[#535359] text-[10px] font-semibold leading-[110%] tracking-[-0.2px] capitalize">
                                    Total Perfect Days
                                </p>

                                <p className="text-[#252525]">
                                    <span className="text-[40px] font-normal leading-normal tracking-[-0.8px]">
                                        {summary?.total_perfect_days ?? "N/A"}
                                    </span>
                                    <span className="text-[10px] font-normal leading-[110%] tracking-[-0.2px] ml-1">
                                        Days
                                    </span>
                                </p>
                            </div>
                        </div>
                    </div>

                    <div>
                        <Progress
                            title="Completion Rate Trend"
                            showDetails={false}
                            showContainer={false}
                        />
                    </div>
                </div>
            </div>

        </>
    );
}