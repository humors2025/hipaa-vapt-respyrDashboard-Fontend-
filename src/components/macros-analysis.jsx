"use client";
import MacrosUpdate from "./macros-update";
import MacrosCalculation from "./macros-calculation";

export default function MacrosAnalysis({ activeTab }) {

    return(
        <>
         <div className="flex gap-5 mt-[17px] mx-[5px]">
                       <MacrosUpdate title="Macros Analysis" activeTab={activeTab}/>
                      <MacrosCalculation />
                   </div>
        </>
    )

}