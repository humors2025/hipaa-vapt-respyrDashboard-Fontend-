"use client"

import HabitsMonitoring from "./habits-monitoring"
import Overview from "./overview"

export default function HabitsAnalysis() {

    return (
        <>

            <div className="flex max-xl:flex-col gap-5 mt-[17px] mx-[5px]">
                <Overview />
                <HabitsMonitoring />
            </div>
        </>
    )
}