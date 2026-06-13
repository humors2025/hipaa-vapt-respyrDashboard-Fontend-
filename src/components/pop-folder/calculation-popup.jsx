"use client";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";

export default function CalculationPopup({ onClose }) {
    const [activeCalculation, setActiveCalculation] = useState("1st CALCULATION");

    const scrollContainerRef = useRef(null);
    const sectionRefs = useRef([]);

    const calculationSteps = [
        { title: "1st CALCULATION", description: "Macro Calculation Based On BMI" },
        { title: "2nd CALCULATION", description: "Macro Adjustment Based On Fitness Goal" },
        { title: "3Rd CALCULATION", description: "Macro Adjustment Based On Metabolism Score" },
        { title: "FINAL CALCULATION", description: "Macro Adjustment Based On Focus" },
    ];

    const userData = {
        name: "Sagar",
        bmi: 19,

        "1st CALCULATION": {
            bmi: 19
        },

        "2nd CALCULATION": {
            goal: "Weight Loss"
        },

        "3Rd CALCULATION": {
            metabolismScore: "81%"
        },

        "FINAL CALCULATION": {
            focus: "Digestive Comfort Day"
        }
    };

    const getStepInfo = (stepTitle) => {
        const infoMap = {
            "1st CALCULATION": {
                label: `${userData.name}'s BMI:`,
                value: `${userData["1st CALCULATION"].bmi} kg/m²`
            },
            "2nd CALCULATION": {
                label: `${userData.name}'s Goal:`,
                value: userData["2nd CALCULATION"].goal
            },
            "3Rd CALCULATION": {
                label: `${userData.name}'s Metabolism Score:`,
                value: userData["3Rd CALCULATION"].metabolismScore
            },
            "FINAL CALCULATION": {
                label: `${userData.name}'s Focus:`,
                value: userData["FINAL CALCULATION"].focus
            }
        };

        return infoMap[stepTitle] || { label: "", value: "" };
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

    const macroData = {
        "1st CALCULATION": {
            macros: [
                { name: "Protein", value: "120g", color: "#E76F51" },
                { name: "Carbs", value: "250g", color: "#2A9D8F" },
                { name: "Fats", value: "65g", color: "#F4A261" },
                { name: "Fiber", value: "30g", color: "#3A86FF" }
            ],
            explanations: [
                {
                    macro: "Protein",
                    color: "#E76F51",
                    text: "uses adjusted bodyweight to prevent over-prescription; take the remaining energy to keep daily output stable."
                },
                {
                    macro: "Carbs",
                    color: "#F4A261",
                    text: "take the remaining energy to keep daily output stable."
                },
                {
                    macro: "Fats",
                    color: "#3A86FF",
                    text: "is set at a supportive minimum to avoid under-fat intake while keeping room for carbs."
                },
                {
                    macro: "Fibre",
                    color: "#2A9D8F",
                    text: "is set by kcal + hydrogen tolerance to keep gut load predictable."
                }
            ]
        },
        "2nd CALCULATION": {
            macros: [
                { name: "Protein", value: "135g", color: "#E76F51", change: "+12g" },
                { name: "Carbs", value: "220g", color: "#2A9D8F", change: "-12g" },
                { name: "Fats", value: "60g", color: "#F4A261", change: "0g" },
                { name: "Fiber", value: "28g", color: "#3A86FF", change: "-7g" }
            ],
            explanations: [
                { macro: "Protein", color: "#E76F51", text: "adjusted based on fitness goal for muscle growth;" },
                { macro: "Carbs", color: "#F4A261", text: "modified to support training intensity." },
                { macro: "Fats", color: "#3A86FF", text: "maintained at essential levels for hormone function." },
                { macro: "Fibre", color: "#2A9D8F", text: "balanced for optimal digestion and satiety." }
            ]
        },
        "3Rd CALCULATION": {
            macros: [
                { name: "Protein", value: "140g", color: "#E76F51", change: "+4g" },
                { name: "Carbs", value: "200g", color: "#2A9D8F", change: "-9g" },
                { name: "Fats", value: "58g", color: "#F4A261", change: "0g" },
                { name: "Fiber", value: "32g", color: "#3A86FF", change: "+14g" }
            ],
            explanations: [
                { macro: "Protein", color: "#E76F51", text: "fine-tuned based on metabolic efficiency score;" },
                { macro: "Carbs", color: "#F4A261", text: "adjusted for individual metabolic response." },
                { macro: "Fats", color: "#3A86FF", text: "optimized for metabolic flexibility." },
                { macro: "Fibre", color: "#2A9D8F", text: "calibrated for digestive health score." }
            ]
        },
        "FINAL CALCULATION": {
            macros: [
                { name: "Protein", value: "145g", color: "#E76F51", change: "+4g" },
                { name: "Carbs", value: "210g", color: "#2A9D8F", change: "0g" },
                { name: "Fats", value: "62g", color: "#F4A261", change: "-7g" },
                { name: "Fiber", value: "35g", color: "#3A86FF", change: "+9g" }
            ],
            explanations: [
                { macro: "Protein", color: "#E76F51", text: "final adjustment based on primary focus area;" },
                { macro: "Carbs", color: "#F4A261", text: "balanced for performance and body composition." },
                { macro: "Fats", color: "#3A86FF", text: "optimized for long-term sustainability." },
                { macro: "Fibre", color: "#2A9D8F", text: "set for optimal gut health and nutrient absorption." }
            ]
        }
    };

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const containerTop = container.getBoundingClientRect().top;
            let currentActive = calculationSteps[0].title;
            let minDistance = Infinity;

            sectionRefs.current.forEach((section, index) => {
                if (!section) return;

                const rect = section.getBoundingClientRect();
                const distance = Math.abs(rect.top - containerTop - 10);

                if (distance < minDistance) {
                    minDistance = distance;
                    currentActive = calculationSteps[index].title;
                }
            });

            setActiveCalculation(currentActive);
        };

        container.addEventListener("scroll", handleScroll);
        handleScroll();

        return () => {
            container.removeEventListener("scroll", handleScroll);
        };
    }, []);

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
                behavior: "smooth"
            });
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
                className="absolute inset-0 bg-black/40"
                onClick={onClose}
            />

            <div className="relative bg-white rounded-[20px] w-[90%] max-w-[725px] max-h-[110vh] overflow-y-auto">
                <button
                    onClick={onClose}
                    className="absolute top-5 right-5 text-[18px] font-bold text-[#252525] z-10 cursor-pointer hover:opacity-70"
                >
                    ✕
                </button>

                <div className="px-4 py-6">
                    <div className="pl-2.5 pb-[25px] border-b border-[#E1E6ED]">
                        <p className="text-[#252525] text-[25px] font-semibold leading-normal tracking-[-1px]">
                            Macro Calculation
                        </p>
                    </div>

                    <div className="mt-1">
                        <div className="w-full rounded-[15px] pt-[15px] pb-2.5 pl-2.5 bg-white">
                            <div className="flex gap-[3px] mt-[15px]">
                                <div className="flex flex-col gap-[15px] pb-[54px] rounded-[15px]">
                                    {calculationSteps.map((step, index) => {
                                        const isActive = activeCalculation === step.title;

                                        return (
                                            <div
                                                key={step.title}
                                                onClick={() => handleStepClick(step.title, index)}
                                                className={`flex flex-col gap-2.5 py-2.5 pl-[15px] pr-2.5 w-[200px] cursor-pointer transition-all duration-200 ${isActive ? "bg-[#F0F6FD] rounded-[10px]" : ""
                                                    } ${!isActive && index !== 0 ? "border-t border-[#E1E6ED]" : ""}`}
                                            >
                                                <p
                                                    className="text-[12px] font-semibold leading-[110%] tracking-[-0.48px]"
                                                    style={{
                                                        color: isActive ? "#308BF9" : "#252525"
                                                    }}
                                                >
                                                    {step.title}
                                                </p>

                                                <p className="text-[10px] font-normal leading-normal tracking-[-0.2px] text-[#738298]">
                                                    {step.description}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div
                                    ref={scrollContainerRef}
                                    className="pt-[7px] pl-[15px] rounded-[15px] flex-1 h-[450px] overflow-y-auto group-hover-scrollbar"
                                >
                                    <div className="flex flex-col gap-0">
                                        {calculationSteps.map((step, index) => {
                                            const stepData = macroData[step.title];
                                            const isActive = activeCalculation === step.title;
                                            const stepInfo = getStepInfo(step.title);
                                            const isFirstCalculation = step.title === "1st CALCULATION";

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
                                                                    color: isActive ? "#308BF9" : "#738298"
                                                                }}
                                                            >
                                                                {step.title}
                                                            </p>

                                                            <p className="text-[#252525] text-[15px] font-semibold leading-normal tracking-[-0.3px]">
                                                                {step.description}
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
                                                            <div className="flex flex-wrap">
                                                                {stepData?.macros.map((macro) => (
                                                                    <div
                                                                        key={macro.name}
                                                                        className="flex flex-col gap-2.5 w-[87px] items-center"
                                                                    >
                                                                        <div className="flex gap-[5px] items-center">
                                                                            <div
                                                                                className="w-[6px] h-[6px] rounded-full"
                                                                                style={{ background: macro.color }}
                                                                            ></div>
                                                                            <p className="text-[#252525] text-[10px] font-semibold capitalize">
                                                                                {macro.name}
                                                                            </p>
                                                                        </div>

                                                                        <div className="flex flex-col justify-center items-center">
                                                                            <p className="text-[#252525] text-[15px] font-semibold">
                                                                                {macro.value}
                                                                            </p>

                                                                            {!isFirstCalculation && (
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
                                                        {stepData?.explanations.map((explanation) => (
                                                            <div key={explanation.macro} className="flex items-start gap-[5px]">
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
                                                        ))}
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
        </div>
    );
}