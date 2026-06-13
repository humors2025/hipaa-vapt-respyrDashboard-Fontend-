"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { useSelector } from "react-redux";

export default function MacrosCalculation() {
  const [activeCalculation, setActiveCalculation] = useState("1st CALCULATION");

  const scrollContainerRef = useRef(null);
  const sectionRefs = useRef([]);

  const clientIndividualProfile = useSelector(
    (state) => state.clientIndividualProfile.data
  );



  const rawTrainerMacroRationale =
    clientIndividualProfile?.data?.raw_json?.trainer_macro_rationale;

  const trainerMacroRationale = Array.isArray(rawTrainerMacroRationale)
    ? rawTrainerMacroRationale
    : [];

  const isNoMacroData =
    rawTrainerMacroRationale === "NA" || trainerMacroRationale.length === 0;

  const profileDetails = clientIndividualProfile?.data?.profile_details || {};
  const profileName = profileDetails?.profile_name || "User";

  const getStepTitle = (stage) => {
    if (stage === 1) return "1st CALCULATION";
    if (stage === 2) return "2nd CALCULATION";
    if (stage === 3) return "3Rd CALCULATION";
    return "FINAL CALCULATION";
  };

  const calculationSteps = trainerMacroRationale.map((item) => ({
    title: getStepTitle(item.stage),
    description: item.title || "",
  }));

  const getStepInfo = (stepTitle) => {
    const current = trainerMacroRationale.find(
      (item) => getStepTitle(item.stage) === stepTitle
    );

    if (!current) return { label: "", value: "" };

    if (current.stage === 1) {
      return {
        label: `${profileName}'s BMI:`,
        value: `${current?.trigger?.value || "-"} kg/m²`,
      };
    }

    if (current.stage === 2) {
      return {
        label: `${profileName}'s Goal:`,
        value: current?.trigger?.value || "-",
      };
    }

    if (current.stage === 3) {
      return {
        label: `${profileName}'s Metabolism Score:`,
        value: "Based on Trends",
      };
    }

    return {
      label: `${profileName}'s Focus:`,
      value: current?.trigger?.focus_day || "-",
    };
  };

  const getChangeIcon = (change) => {
    if (!change) return "/icons/hugeicons_equal-sign-circle.svg";

    const value = change.toString().trim();

    if (value.startsWith("+")) {
      return "/icons/hugeicons_arrow-down-020.svg";
    }

    if (value.startsWith("-")) {
      return "/icons/hugeicons_arrow-down-002.svg";
    }

    return "/icons/hugeicons_equal-sign-circle.svg";
  };

  const macroData = {};

  trainerMacroRationale.forEach((item) => {
    const stepTitle = getStepTitle(item.stage);

    const after = item?.macros_after_stage || {};
    const change = item?.change_from_previous || {};
    const logic = item?.logic || {};

    macroData[stepTitle] = {
      macros: [
        {
          name: "Protein",
          value: `${after?.protein_g ?? 0}g`,
          color: "#E76F51",
          change: `${change?.protein_g ?? 0}g`,
        },
        {
          name: "Carbs",
          value: `${after?.carbs_g ?? 0}g`,
          color: "#2A9D8F",
          change: `${change?.carbs_g ?? 0}g`,
        },
        {
          name: "Fats",
          value: `${after?.fat_g ?? 0}g`,
          color: "#F4A261",
          change: `${change?.fat_g ?? 0}g`,
        },
        {
          name: "Fiber",
          value: `${after?.fiber_g ?? 0}g`,
          color: "#3A86FF",
          change: `${change?.fiber_g ?? 0}g`,
        },
        {
          name: "Calories",
          value: `${after?.calories ?? 0} kcal`,
          color: "#535359",
          change: "-",
        },
      ],
      explanations: [
        {
          macro: "Protein",
          color: "#E76F51",
          text: logic?.protein_rationale || "",
        },
        {
          macro: "Carbs",
          color: "#2A9D8F",
          text: logic?.carb_rationale || "",
        },
        {
          macro: "Fats",
          color: "#F4A261",
          text: logic?.fat_rationale || "",
        },
        {
          macro: "Fiber",
          color: "#3A86FF",
          text: logic?.fiber_rationale || "",
        },
        {
          macro: "Summary",
          color: "#738298",
          text: item?.stage_summary || "",
        },
      ],
    };
  });

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || isNoMacroData) return;

    const handleScroll = () => {
      const containerTop = container.getBoundingClientRect().top;
      let currentActive = calculationSteps[0]?.title || "1st CALCULATION";
      let minDistance = Infinity;

      sectionRefs.current.forEach((section, index) => {
        if (!section) return;

        const rect = section.getBoundingClientRect();
        const distance = Math.abs(rect.top - containerTop - 10);

        if (distance < minDistance) {
          minDistance = distance;
          currentActive = calculationSteps[index]?.title || currentActive;
        }
      });

      setActiveCalculation(currentActive);
    };

    container.addEventListener("scroll", handleScroll);
    handleScroll();

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [calculationSteps, isNoMacroData]);

  const handleStepClick = (title, index) => {
    setActiveCalculation(title);

    const section = sectionRefs.current[index];
    const container = scrollContainerRef.current;

    if (section && container) {
      const containerTop = container.getBoundingClientRect().top;
      const sectionTop = section.getBoundingClientRect().top;

      const scrollOffset = sectionTop - containerTop + container.scrollTop;

      container.scrollTo({
        top: scrollOffset - 10,
        behavior: "smooth",
      });
    }
  };

  if (isNoMacroData) {
    return (
      <div className="relative bg-white rounded-[20px] w-full overflow-hidden">
        <div className="border border-[#E1E6ED] rounded-[15px] px-4 py-6">
          <div className="pl-2.5 pb-5">
            <p className="text-[#252525] text-[25px] font-semibold leading-normal tracking-[-1px]">
              Macro Calculation
            </p>
          </div>

          <div className="h-[250px] flex items-center justify-center rounded-[15px] bg-[#F5F7FA] border border-[#E1E6ED]">
            <p className="text-[#738298] text-[14px] font-medium">
              No data found
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative bg-white rounded-[20px] w-full overflow-hidden">
      <div className="border border-[#E1E6ED] rounded-[15px] px-4 py-6">
        <div className="pl-2.5 pb-5">
          <p className="text-[#252525] text-[25px] font-semibold leading-normal tracking-[-1px]">
            Macro Calculation
          </p>
        </div>

        <div>
          <div className="w-full rounded-[15px] bg-white">
            <div className="flex gap-[3px]">
              <div className="flex flex-col gap-[15px] pb-[54px] rounded-[15px]">
                {calculationSteps.map((step, index) => {
                  const isActive = activeCalculation === step.title;

                  return (
                    <div
                      key={step.title}
                      onClick={() => handleStepClick(step.title, index)}
                      className={`flex flex-col gap-2.5 py-2.5 pl-[15px] pr-2.5 w-[200px] cursor-pointer transition-all duration-200 ${
                        isActive ? "bg-[#F0F6FD] rounded-[10px]" : ""
                      } ${
                        !isActive && index !== 0
                          ? "border-t border-[#E1E6ED]"
                          : ""
                      }`}
                    >
                      <p
                        className="text-[12px] font-semibold leading-[110%] tracking-[-0.48px]"
                        style={{
                          color: isActive ? "#308BF9" : "#252525",
                        }}
                      >
                        {step.title}
                      </p>

                      <p className="text-[10px] font-normal leading-normal tracking-[-0.2px] text-[#738298]">
                       {step.description === "BMI Based Baseline" 
    ? "BMR Based Baseline" 
    : step.description}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div
                ref={scrollContainerRef}
                className="pt-[7px] pl-[15px] rounded-[15px] flex-1 h-[350px] overflow-y-auto group-hover-scrollbar"
              >
                <div className="flex flex-col gap-0">
                  {calculationSteps.map((step, index) => {
                    const stepData = macroData[step.title];
                    const isActive = activeCalculation === step.title;
                    const stepInfo = getStepInfo(step.title);
                    const isFirstCalculation =
                      step.title === "1st CALCULATION";

                    return (
                      <div
                        ref={(el) => (sectionRefs.current[index] = el)}
                        key={step.title}
                        className="relative flex flex-col gap-6 border-l-2 border-[#E1E6ED] pl-[20px] pr-[15px] pt-[6px] pb-6 last:pb-0"
                      >
                        <div className="absolute left-[-6px] top-[10px]">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="10"
                            height="10"
                            viewBox="0 0 10 10"
                            fill="none"
                          >
                            <circle
                              cx="5"
                              cy="5"
                              r="5"
                              fill={isActive ? "#308BF9" : "#E1E6ED"}
                            />
                          </svg>
                        </div>

                        <div className="flex flex-col gap-[30px]">
                          <div className="flex flex-col gap-[15px]">
                            <p
                              className="text-[12px] font-semibold leading-normal tracking-[-0.24px] uppercase"
                              style={{
                                color: isActive ? "#308BF9" : "#738298",
                              }}
                            >
                              {step.title}
                            </p>

                            <p className="text-[#252525] text-[15px] font-semibold leading-normal tracking-[-0.3px]">
  {step.description === "BMI Based Baseline" 
    ? "BMR Based Baseline" 
    : step.description}
</p>

                            <div className="flex gap-[5px] bg-[#F5F7FA] rounded-[5px] px-[15px] py-1.5">
                              <p className="text-[#535359] text-[12px] font-normal leading-normal tracking-[-0.24px]">
                                {stepInfo.label}
                              </p>
                              <p className="text-[#535359] text-[12px] font-semibold leading-normal tracking-[-0.24px]">
                                {stepInfo.value}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2.5">
                            <div className="flex flex-1 justify-between">
                              {stepData?.macros.map((macro) => (
                                <div
                                  key={macro.name}
                                  className="flex flex-col gap-2.5 items-center"
                                >
                                  <div className="flex gap-[5px] items-center">
                                    <div
                                      className="w-[6px] h-[6px] rounded-full"
                                      style={{ background: macro.color }}
                                    ></div>
                                    <p className="text-[#252525] text-[10px] font-semibold tracking-[-0.2px] capitalize">
                                      {macro.name}
                                    </p>
                                  </div>

                                  <div className="flex flex-col justify-center items-center">
                                    <p className="text-[#252525] text-[15px] font-semibold tracking-[-0.3px] whitespace-nowrap">
                                      {String(macro.value)
                                        .replace(/[a-zA-Z]+|kcal/g, "")
                                        .trim()}
                                      <span className="text-[#252525] text-[10px] font-normal">
                                        {String(macro.value).includes("kcal")
                                          ? "kcal"
                                          : "g"}
                                      </span>
                                    </p>

                                    {!isFirstCalculation &&
                                      macro.name !== "Calories" && (
                                        <div className="flex items-center gap-0.5">
                                          <Image
                                            src={getChangeIcon(macro.change)}
                                            alt="change icon"
                                            width={20}
                                            height={20}
                                          />
                                          <p className="text-[10px] font-semibold py-[2.5px] text-[#252525] tracking-[-0.2px]">
                                            {macro.change || "-"}
                                          </p>
                                        </div>
                                      )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-[5px]">
                          {stepData?.explanations.map((explanation) => {
                            const isSummary = explanation.macro === "Summary";

                            if (isSummary) {
                              return (
                                <div
                                  key={explanation.macro}
                                  className="mt-[10px]"
                                >
                                  <p className="text-[#252525] text-[13px] font-semibold leading-[130%]">
                                    {explanation.macro}
                                  </p>

                                  <p className="text-[#535359] text-[12px] font-normal leading-[130%] mt-[3px]">
                                    {explanation.text}
                                  </p>
                                </div>
                              );
                            }

                            return (
                              <div
                                key={explanation.macro}
                                className="flex items-start gap-[5px]"
                              >
                                <div
                                  className="w-[6px] h-[6px] rounded-full mt-[5px] shrink-0"
                                  style={{ background: explanation.color }}
                                ></div>

                                <p className="text-[#535359] text-[12px] font-normal leading-[130%]">
                                  <span
                                    className="font-semibold"
                                    style={{ color: explanation.color }}
                                  >
                                    {explanation.macro}
                                  </span>{" "}
                                  {explanation.text}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
