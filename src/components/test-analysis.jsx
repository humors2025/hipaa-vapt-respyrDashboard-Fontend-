"use client";

import FatUsePatternTrend from "./Fat-use-pattern-Trend";
import Progress from "./progress";
import TrendBreakdown from "./trend-breakdown";
import TrainerNote from "./trainer-note";

export default function TestAnalysis() {
    return (
        <div className="flex flex-col gap-5 mt-[17px] mb-[22px] mx-[5px] min-h-full">
            <div className="flex gap-5 flex-1 min-h-[400px]">
                <div className="flex-1 flex">
                    <FatUsePatternTrend />
                </div>
                <div className="flex-1 flex">
                    <TrendBreakdown />
                </div>
            </div>

            <div className="flex gap-5 flex-1 min-h-[400px]">
                <div className="flex-1 flex">
                    <Progress />
                </div>
                <div className="flex-1 flex">
                    <TrainerNote />
                </div>
            </div>
        </div>
    );
}