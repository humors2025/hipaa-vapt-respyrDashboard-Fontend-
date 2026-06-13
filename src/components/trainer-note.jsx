"use client";
import { useSelector } from "react-redux";
import {
  selectClientIndividualProfileData,
} from "../store/clientIndividualProfileSlice";

export default function TrainerNote() {
 const clientIndividualProfile = useSelector(selectClientIndividualProfileData);

 const trainerNoteSection = clientIndividualProfile?.data?.trainer_note_section;


    return (
        <>


            <div className="w-full pt-[25px] pb-5 pl-5 pr-[22px] bg-[#F5F7FA] rounded-[10px]">

                <p className="text-[#738298] text-[12px] font-semibold leading-normal tracking-[-0.24px] uppercase">TRAINER NOTE</p>

                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2 mt-[22px]">
                        <p className="text-[#252525] text-[12px] font-normal leading-normal tracking-[-0.24px]">What to focus on today</p>
                        <p className="text-[#252525] text-[25px] font-semibold leading-normal tracking-[-0.5px]"> {trainerNoteSection?.title || "NA"}</p>
                    </div>


                    <p className="text-[#738298] text-[12px] font-normal leading-[130%]">
                        {trainerNoteSection?.note || "NA"}
                    </p>
                </div>
            </div>


        </>

    )
}