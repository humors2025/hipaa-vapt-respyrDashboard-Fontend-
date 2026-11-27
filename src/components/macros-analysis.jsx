"use client";
import { useState } from "react";
import MacrosUpdate from "./macros-update";
import MacrosCalculation from "./macros-calculation";
import MacrosEditPanel from "./macros-edit-panel";

export default function MacrosAnalysis({ activeTab }) {
    // The edit the panel is showing (active this plan week, else next
    // upcoming) — the graph above can switch between test and edited macros.
    const [featuredEdit, setFeaturedEdit] = useState(null);

    return(
        <>
         <div className="flex max-2xl:flex-col gap-5 mt-[17px] mx-[5px]">
                       <div className="flex flex-col gap-5 max-2xl:w-full">
                         <MacrosUpdate title="Macros Analysis" activeTab={activeTab} editedMacros={featuredEdit}/>
                         {/* Hand-edited macros with a date range — used for the diet plan */}
                         <MacrosEditPanel activeTab={activeTab} onFeaturedChange={setFeaturedEdit} />
                       </div>
                      <MacrosCalculation />
                   </div>
        </>
    )

}
