"use client";

// Trainer Direction tab content — embedded as a sibling to Test/Macros/Diet/
// Habits Analysis inside the client profile (client-details.jsx). Reads from
// the same clientIndividualProfile Redux state those siblings use, so no
// extra fetch needed.
//
// Internal sub-tabs (At a Glance / Why Today's Plan) come from the engineer's
// design; more sub-tabs land in subsequent phases (Coach's Brief, etc.).

import { useState } from "react";
import { useSelector } from "react-redux";

import TrainerDirectionTabs from "./TrainerDirectionTabs";
import AtAGlance from "./AtAGlance";
import CoachsBrief from "./CoachsBrief";
import TodaysSession from "./TodaysSession";
import CoachsPlaybook from "./CoachsPlaybook";
import WhyTodaysPlan from "./WhyTodaysPlan";
import FoodDirection from "./FoodDirection";
import WatchAndPlan from "./WatchAndPlan";

export default function TrainerDirection() {
  const [activeTab, setActiveTab] = useState("glance");

  const clientIndividualProfile = useSelector(
    (state) => state.clientIndividualProfile.data
  );
  const status = useSelector((state) => state.clientIndividualProfile.status);

  // Read defensively — the trainer_direction_elite payload may be either
  // directly under raw_json (current prod shape) or wrapped under
  // raw_json.respyr_response (the shape from full_json.txt).
  const td =
    clientIndividualProfile?.data?.raw_json?.trainer_direction_elite ||
    clientIndividualProfile?.data?.raw_json?.respyr_response?.trainer_direction_elite;

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center py-16 text-[#A1A1A1] text-[13px]">
        Loading training direction…
      </div>
    );
  }

  if (!td) {
    return (
      <div className="rounded-[12px] border border-dashed border-[#E1E6ED] bg-white p-6 m-5">
        <h2 className="text-[#252525] text-[16px] font-bold">No training direction data</h2>
        <p className="text-[#535359] text-[13px] mt-2 leading-[1.5]">
          The backend hasn't returned trainer-direction output for this client/date.
          Either no breath reading exists, or the engine response is missing
          <code className="px-1.5 py-0.5 mx-1 bg-[#F5F7FA] rounded text-[11px]">trainer_direction_elite</code>.
          Try selecting a different date in the strip above.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-5">
      <TrainerDirectionTabs activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === "glance"   && <AtAGlance      data={td} />}
      {activeTab === "brief"    && <CoachsBrief    data={td} />}
      {activeTab === "session"  && <TodaysSession  data={td} />}
      {activeTab === "playbook" && <CoachsPlaybook data={td} />}
      {activeTab === "why"      && <WhyTodaysPlan  data={td} />}
      {activeTab === "food"     && <FoodDirection  data={td} />}
      {activeTab === "watch"    && <WatchAndPlan   data={td} />}
    </div>
  );
}
