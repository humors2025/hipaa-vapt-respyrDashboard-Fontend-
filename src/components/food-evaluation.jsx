"use client"
import Image from "next/image"
import { useSelector } from "react-redux"

export default function FoodEvaluation() {
    const scoresInsight = useSelector((state) => state.scoresInsight?.data);

    return (
        <>
            <div className="mt-[70px]">
                <div className="flex gap-5 ml-[45px]">
                    <div className="flex flex-col gap-2.5">
                        <span className="text-[#252525] text-[20px] font-semibold leading-[110%] tracking-[-0.4px]">Food Evaluation</span>
                        {/* <span className="text-[#535359] text-[10px] font-normal leading-[110%] tracking-[-0.2px] capitalize">Last Logged 05 Jul, 12:30pm</span> */}
                    </div>
                    <div className="flex gap-[15px] items-center">
                        <div className="relative w-[41px] h-[41px]">
                            {/* Track + Progress */}
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 41 41"
                                fill="none"
                                className="absolute inset-0 w-full h-full"
                            >
                                {/* gray track */}
                                <circle cx="20.5" cy="20.5" r="18.5" stroke="#D9D9D9" strokeWidth="3" />
                                {/* Dynamic progress based on nutrition_total_percent */}
                                <path
                                    d="M39 20.5C39 10.2827 30.7173 2 20.5 2C10.2827 2 2 10.2827 2 20.5C2 30.7173 10.2827 39 20.5 39C25.2292 39 29.5439 37.2255 32.8147 34.306"
                                    stroke="#3FAF58"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeDasharray="116"
                                    strokeDashoffset={116 - (116 * (scoresInsight?.nutrition_total_percent || 0)) / 100}
                                />
                            </svg>

                            {/* centered icon */}
                            <Image
                                src="/icons/hugeicons_award-03.svg"
                                alt="hugeicons_award-03"
                                width={24}
                                height={24}
                                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                            />
                        </div>

                        <div className="flex flex-col gap-2.5">
                            <span className="text-[#252525] text-[10px] font-normal leading-[110%] tracking-[-0.2px] capitalize">Daily Goal</span>
                            <span className="text-[#252525] text-[15px] font-semibold leading-[126%] tracking-[-0.3px]">
                                {Math.round(scoresInsight?.nutrition_total_percent || 0)}% completed
                            </span>
                        </div>
                    </div>
                </div>

                <div className="border border-[#E1E6ED] mt-[18px]"></div>

                <div className="flex gap-[50px] mt-[30px]">

                    <div className="flex gap-5 items-center">
                        <div className="relative w-[51px] h-[51px] flex items-center justify-center">
                            {/* Gray track circle */}
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 51 51"
                                fill="none"
                                className="absolute inset-0 w-full h-full"
                            >
                                <circle
                                    cx="25.5"
                                    cy="25.5"
                                    r="22.5"
                                    stroke="#D9D9D9"
                                    strokeWidth="5"
                                />
                            </svg>

                            {/* Dynamic Orange progress arc */}
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 51 51"
                                fill="none"
                                className="absolute inset-0 w-full h-full"
                            >
                                <circle
                                    cx="25.5"
                                    cy="25.5"
                                    r="22.5"
                                    stroke="#FF9800"
                                    strokeWidth="5"
                                    strokeLinecap="round"
                                    fill="none"
                                    strokeDasharray="141.4" // Circumference = 2 * π * r = 2 * 3.14159 * 22.5 ≈ 141.4
                                    strokeDashoffset={141.4 - (141.4 * (scoresInsight?.food_log_percentage?.calories || 0)) / 100}
                                    transform="rotate(-90 25.5 25.5)"
                                />
                            </svg>

                            {/* Centered icon */}
                            <Image
                                src="/icons/calories.svg"
                                alt="calories"
                                width={24}
                                height={24}
                                className="relative"
                            />
                        </div>

                        {/* Text block */}
                        <div className="flex flex-col gap-[11px]">
                            <span className="text-[#535359] text-[12px] font-semibold leading-[110%] tracking-[-0.24px] capitalize">
                                Calories
                            </span>
                            <span className="text-[#252525] text-[18px] font-semibold leading-[126%] tracking-[-0.36px]">
                                {scoresInsight?.food_log_totals?.calories || 0}/{scoresInsight?.plan_targets?.calories || 0} kcal
                            </span>
                        </div>
                    </div>

                    <div className="w-full flex gap-[20px]">
                        {/* Protein */}
                        <div className="w-full bg-[#F5F7FA] rounded-[10px] py-2.5 pl-5 pr-2.5">
                            <div>
                                <span className="text-[#535359] text-[14px] font-medium">Protein</span>
                            </div>

                           <div className="flex justify-start py-[15px]">
    <svg viewBox="0 0 117 6" className="h-[6px]">
        {/* Gray track */}
        <path
            d="M3 3H114"
            stroke="#D9D9D9"
            strokeWidth="5"
            strokeLinecap="round"
        />

        {/* Show colored bar only if > 0 */}
        {(scoresInsight?.food_log_percentage?.protein || 0) > 0 && (
            <path
                d={`M3 3H${
                    (scoresInsight?.food_log_percentage?.protein || 0) * 1.17
                }`}
                stroke="#FFC107"
                strokeWidth="5"
                strokeLinecap="round"
            />
        )}
    </svg>
</div>


                            <div className="mt-3 flex flex-col gap-[5px]">
                                <span className="text-[#252525] text-[18px] font-semibold leading-[126%] tracking-[-0.36px]">
                                    {scoresInsight?.food_log_totals?.protein || 0}g
                                </span>
                                <span className="text-[#252525] text-[10px] leading-[126%] tracking-[-0.2px]">
                                    out of {scoresInsight?.plan_targets?.protein || 0}g
                                </span>
                            </div>
                        </div>

                        {/* Carbs */}
                        <div className="w-full bg-[#F5F7FA] rounded-[10px] py-2.5 pl-5 pr-2.5">
                            <div>
                                <span className="text-[#535359] text-[14px] font-medium">Carbs</span>
                            </div>

                          <div className="flex justify-start py-[15px]">
    <svg viewBox="0 0 117 6" className="h-[6px]">
        {/* Gray background track */}
        <path
            d="M3 3H114"
            stroke="#D9D9D9"
            strokeWidth="5"
            strokeLinecap="round"
        />

        {/* Show green progress ONLY if > 0 */}
        {(scoresInsight?.food_log_percentage?.carbs || 0) > 0 && (
            <path
                d={`M3 3H${
                    (scoresInsight?.food_log_percentage?.carbs || 0) * 1.17
                }`}
                stroke="#38A250"
                strokeWidth="5"
                strokeLinecap="round"
            />
        )}
    </svg>
</div>


                            <div className="mt-3 flex flex-col gap-[5px]">
                                <span className="text-[#252525] text-[18px] font-semibold leading-[126%] tracking-[-0.36px]">
                                    {scoresInsight?.food_log_totals?.carbs || 0}g
                                </span>
                                <span className="text-[#252525] text-[10px] leading-[126%] tracking-[-0.2px]">
                                    out of {scoresInsight?.plan_targets?.carbs || 0}g
                                </span>
                            </div>
                        </div>

                        {/* Fats */}
                        <div className="w-full bg-[#F5F7FA] rounded-[10px] py-2.5 pl-5 pr-2.5">
                            <div>
                                <span className="text-[#535359] text-[14px] font-medium">Fats</span>
                            </div>

                          <div className="flex justify-start py-[15px]">
    <svg viewBox="0 0 117 6" className="h-[6px]">
        {/* Gray background track */}
        <path
            d="M3 3H114"
            stroke="#D9D9D9"
            strokeWidth="5"
            strokeLinecap="round"
        />

        {/* Green bar only if fat > 0 */}
        {(scoresInsight?.food_log_percentage?.fat || 0) > 0 && (
            <path
                d={`M3 3H${
                    (scoresInsight?.food_log_percentage?.fat || 0) * 1.17
                }`}
                stroke="#38A250"
                strokeWidth="5"
                strokeLinecap="round"
            />
        )}
    </svg>
</div>

                            <div className="mt-3 flex flex-col gap-[5px]">
                                <span className="text-[#252525] text-[18px] font-semibold leading-[126%] tracking-[-0.36px]">
                                    {scoresInsight?.food_log_totals?.fat || 0}g
                                </span>
                                <span className="text-[#252525] text-[10px] leading-[126%] tracking-[-0.2px]">
                                    out of {scoresInsight?.plan_targets?.fat || 0}g
                                </span>
                            </div>
                        </div>

                        {/* Fiber */}
                        <div className="w-full bg-[#F5F7FA] rounded-[10px] py-2.5 pl-5 pr-2.5">
                            <div>
                                <span className="text-[#535359] text-[14px] font-medium">Fiber</span>
                            </div>

                           <div className="flex justify-start py-[15px]">
    <svg viewBox="0 0 117 6" className="h-[6px]">
        {/* Gray background track */}
        <path
            d="M3 3H114"
            stroke="#D9D9D9"
            strokeWidth="5"
            strokeLinecap="round"
        />

        {/* Yellow bar only if fiber > 0 */}
        {(scoresInsight?.food_log_percentage?.fiber || 0) > 0 && (
            <path
                d={`M3 3H${
                    (scoresInsight?.food_log_percentage?.fiber || 0) * 1.17
                }`}
                stroke="#FFC412"
                strokeWidth="5"
                strokeLinecap="round"
            />
        )}
    </svg>
</div>

                            <div className="mt-3 flex flex-col gap-[5px]">
                                <span className="text-[#252525] text-[18px] font-semibold leading-[126%] tracking-[-0.36px]">
                                    {scoresInsight?.food_log_totals?.fiber || 0}g
                                </span>
                                <span className="text-[#252525] text-[10px] leading-[126%] tracking-[-0.2px]">
                                    out of {scoresInsight?.plan_targets?.fiber || 0}g
                                </span>
                            </div>
                        </div>

                        {/* Water - Added Section */}
                        {/* <div className="w-full bg-[#F5F7FA] rounded-[10px] py-2.5 pl-5 pr-2.5">
                            <div>
                                <span className="text-[#535359] text-[14px] font-medium">Water</span>
                            </div>

                            <div className="flex justify-start py-[15px]">
                                <svg viewBox="0 0 117 6" className="h-[6px]">
                                    <path
                                        d="M3 3H114"
                                        stroke="#D9D9D9"
                                        strokeWidth="5"
                                        strokeLinecap="round"
                                    />
                                    <path
                                        d={`M3 3H${(scoresInsight?.food_log_percentage?.water || 0) * 1.17}`}
                                        stroke="#2196F3"
                                        strokeWidth="5"
                                        strokeLinecap="round"
                                    />
                                </svg>
                            </div>

                            <div className="mt-3 flex flex-col gap-[5px]">
                                <span className="text-[#252525] text-[18px] font-semibold leading-[126%] tracking-[-0.36px]">
                                    {scoresInsight?.food_log_totals?.water || 0}ml
                                </span>
                                <span className="text-[#252525] text-[10px] leading-[126%] tracking-[-0.2px]">
                                    out of {scoresInsight?.plan_targets?.water || 0}ml
                                </span>
                            </div>
                        </div> */}
                    </div>
                </div>
            </div>
        </>
    )
}