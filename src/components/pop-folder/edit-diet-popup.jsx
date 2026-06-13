
"use client";
import { useState } from "react";
import Image from "next/image";

export default function EditDietPopup({ closePopup }) {
    const [activeDay, setActiveDay] = useState(1);
    const [activeMeal, setActiveMeal] = useState("Breakfast");

    const days = ["D1", "D2", "D3", "D4", "D5", "D6", "D7"];

    const meals = [
        { name: "Breakfast", time: "08:00-09:00AM" },
        { name: "Lunch", time: "12:30-01:30PM" },
        { name: "Dinner", time: "08:00-09:00PM" },
    ];

    const mealDetails = {
        Breakfast: [
            {
                id: 1,
                icon: "/icons/hugeicons_bubble-tea-02.svg",
                options: [
                    {
                        title:
                            "Carrot + beetroot + fresh turmeric & zinger [ little ] with lemon drops",
                        kcal: "220kcal",
                        serving: "1 cup (250 ml)",
                        macros: [
                            { value: "25g", bg: "bg-[#E76F511A]", text: "text-[#E76F51]" },
                            { value: "25g", bg: "bg-[#2A9D8F1A]", text: "text-[#2A9D8F]" },
                            { value: "25g", bg: "bg-[#F4A2611A]", text: "text-[#F4A261]" },
                            { value: "25g", bg: "bg-[#3A86FF1A]", text: "text-[#3A86FF]" },
                        ],
                    },
                    {
                        title: "Cinnamon water",
                        kcal: "",
                        serving: "1 cup (250 ml)",
                        macros: [
                            { value: "25g", bg: "bg-[#E76F511A]", text: "text-[#E76F51]" },
                            { value: "25g", bg: "bg-[#2A9D8F1A]", text: "text-[#2A9D8F]" },
                            { value: "25g", bg: "bg-[#F4A2611A]", text: "text-[#F4A261]" },
                            { value: "25g", bg: "bg-[#3A86FF1A]", text: "text-[#3A86FF]" },
                        ],
                    },
                ],
            },
            {
                id: 2,
                icon: "/icons/hugeicons_plant-045.svg",
                options: [
                    {
                        title: "Almonds [soaked + de skinned]",
                        kcal: "220kcal",
                        serving: "1 cup (250 ml)",
                        macros: [
                            { value: "25g", bg: "bg-[#E76F511A]", text: "text-[#E76F51]" },
                            { value: "25g", bg: "bg-[#2A9D8F1A]", text: "text-[#2A9D8F]" },
                            { value: "25g", bg: "bg-[#F4A2611A]", text: "text-[#F4A261]" },
                            { value: "25g", bg: "bg-[#3A86FF1A]", text: "text-[#3A86FF]" },
                        ],
                    },
                ],
            },
            {
                id: 3,
                icon: "/icons/hugeicons_plant-045.svg",
                options: [
                    {
                        title: "Potato Chicken Mutton",
                        kcal: "220kcal",
                        serving: "1 cup (250 ml)",
                        macros: [
                            { value: "25g", bg: "bg-[#E76F511A]", text: "text-[#E76F51]" },
                            { value: "25g", bg: "bg-[#2A9D8F1A]", text: "text-[#2A9D8F]" },
                            { value: "25g", bg: "bg-[#F4A2611A]", text: "text-[#F4A261]" },
                            { value: "25g", bg: "bg-[#3A86FF1A]", text: "text-[#3A86FF]" },
                        ],
                    },
                ],
            },
            {
                id: 4,
                icon: "/icons/hugeicons_bubble-tea-02.svg",
                options: [
                    {
                        title: "Green smoothie with chia seeds",
                        kcal: "180kcal",
                        serving: "1 glass",
                        macros: [
                            { value: "20g", bg: "bg-[#E76F511A]", text: "text-[#E76F51]" },
                            { value: "18g", bg: "bg-[#2A9D8F1A]", text: "text-[#2A9D8F]" },
                            { value: "12g", bg: "bg-[#F4A2611A]", text: "text-[#F4A261]" },
                            { value: "10g", bg: "bg-[#3A86FF1A]", text: "text-[#3A86FF]" },
                        ],
                    },
                ],
            },
            {
                id: 5,
                icon: "/icons/hugeicons_plant-045.svg",
                options: [
                    {
                        title: "Boiled sprouts salad",
                        kcal: "200kcal",
                        serving: "1 bowl",
                        macros: [
                            { value: "22g", bg: "bg-[#E76F511A]", text: "text-[#E76F51]" },
                            { value: "16g", bg: "bg-[#2A9D8F1A]", text: "text-[#2A9D8F]" },
                            { value: "14g", bg: "bg-[#F4A2611A]", text: "text-[#F4A261]" },
                            { value: "9g", bg: "bg-[#3A86FF1A]", text: "text-[#3A86FF]" },
                        ],
                    },
                ],
            },
        ],
        Lunch: [
            {
                id: 1,
                icon: "/icons/hugeicons_bubble-tea-02.svg",
                options: [
                    {
                        title: "Lunch Item 1",
                        kcal: "220kcal",
                        serving: "1 plate",
                        macros: [
                            { value: "25g", bg: "bg-[#E76F511A]", text: "text-[#E76F51]" },
                            { value: "25g", bg: "bg-[#2A9D8F1A]", text: "text-[#2A9D8F]" },
                            { value: "25g", bg: "bg-[#F4A2611A]", text: "text-[#F4A261]" },
                            { value: "25g", bg: "bg-[#3A86FF1A]", text: "text-[#3A86FF]" },
                        ],
                    },
                ],
            },
            {
                id: 2,
                icon: "/icons/hugeicons_plant-045.svg",
                options: [
                    {
                        title: "Brown rice with dal",
                        kcal: "320kcal",
                        serving: "1 plate",
                        macros: [
                            { value: "35g", bg: "bg-[#E76F511A]", text: "text-[#E76F51]" },
                            { value: "20g", bg: "bg-[#2A9D8F1A]", text: "text-[#2A9D8F]" },
                            { value: "18g", bg: "bg-[#F4A2611A]", text: "text-[#F4A261]" },
                            { value: "12g", bg: "bg-[#3A86FF1A]", text: "text-[#3A86FF]" },
                        ],
                    },
                ],
            },
            {
                id: 3,
                icon: "/icons/hugeicons_bubble-tea-02.svg",
                options: [
                    {
                        title: "Grilled paneer with vegetables",
                        kcal: "280kcal",
                        serving: "1 plate",
                        macros: [
                            { value: "24g", bg: "bg-[#E76F511A]", text: "text-[#E76F51]" },
                            { value: "21g", bg: "bg-[#2A9D8F1A]", text: "text-[#2A9D8F]" },
                            { value: "15g", bg: "bg-[#F4A2611A]", text: "text-[#F4A261]" },
                            { value: "11g", bg: "bg-[#3A86FF1A]", text: "text-[#3A86FF]" },
                        ],
                    },
                ],
            },
            {
                id: 4,
                icon: "/icons/hugeicons_plant-045.svg",
                options: [
                    {
                        title: "Chapati with sabji and curd",
                        kcal: "300kcal",
                        serving: "1 meal",
                        macros: [
                            { value: "30g", bg: "bg-[#E76F511A]", text: "text-[#E76F51]" },
                            { value: "18g", bg: "bg-[#2A9D8F1A]", text: "text-[#2A9D8F]" },
                            { value: "16g", bg: "bg-[#F4A2611A]", text: "text-[#F4A261]" },
                            { value: "10g", bg: "bg-[#3A86FF1A]", text: "text-[#3A86FF]" },
                        ],
                    },
                ],
            },
        ],
        Snacks: [
            {
                id: 1,
                icon: "/icons/hugeicons_bubble-tea-02.svg",
                options: [
                    {
                        title: "Snacks Item 1",
                        kcal: "220kcal",
                        serving: "1 bowl",
                        macros: [
                            { value: "25g", bg: "bg-[#E76F511A]", text: "text-[#E76F51]" },
                            { value: "25g", bg: "bg-[#2A9D8F1A]", text: "text-[#2A9D8F]" },
                            { value: "25g", bg: "bg-[#F4A2611A]", text: "text-[#F4A261]" },
                            { value: "25g", bg: "bg-[#3A86FF1A]", text: "text-[#3A86FF]" },
                        ],
                    },
                ],
            },
            {
                id: 2,
                icon: "/icons/hugeicons_plant-045.svg",
                options: [
                    {
                        title: "Fruit bowl with nuts",
                        kcal: "190kcal",
                        serving: "1 bowl",
                        macros: [
                            { value: "20g", bg: "bg-[#E76F511A]", text: "text-[#E76F51]" },
                            { value: "15g", bg: "bg-[#2A9D8F1A]", text: "text-[#2A9D8F]" },
                            { value: "10g", bg: "bg-[#F4A2611A]", text: "text-[#F4A261]" },
                            { value: "8g", bg: "bg-[#3A86FF1A]", text: "text-[#3A86FF]" },
                        ],
                    },
                ],
            },
            {
                id: 3,
                icon: "/icons/hugeicons_bubble-tea-02.svg",
                options: [
                    {
                        title: "Roasted makhana",
                        kcal: "160kcal",
                        serving: "1 bowl",
                        macros: [
                            { value: "18g", bg: "bg-[#E76F511A]", text: "text-[#E76F51]" },
                            { value: "13g", bg: "bg-[#2A9D8F1A]", text: "text-[#2A9D8F]" },
                            { value: "9g", bg: "bg-[#F4A2611A]", text: "text-[#F4A261]" },
                            { value: "7g", bg: "bg-[#3A86FF1A]", text: "text-[#3A86FF]" },
                        ],
                    },
                ],
            },
        ],
        Dinner: [
            {
                id: 1,
                icon: "/icons/hugeicons_bubble-tea-02.svg",
                options: [
                    {
                        title: "Dinner Item 1",
                        kcal: "220kcal",
                        serving: "1 plate",
                        macros: [
                            { value: "25g", bg: "bg-[#E76F511A]", text: "text-[#E76F51]" },
                            { value: "25g", bg: "bg-[#2A9D8F1A]", text: "text-[#2A9D8F]" },
                            { value: "25g", bg: "bg-[#F4A2611A]", text: "text-[#F4A261]" },
                            { value: "25g", bg: "bg-[#3A86FF1A]", text: "text-[#3A86FF]" },
                        ],
                    },
                ],
            },
            {
                id: 2,
                icon: "/icons/hugeicons_plant-045.svg",
                options: [
                    {
                        title: "Soup with sauteed vegetables",
                        kcal: "210kcal",
                        serving: "1 bowl",
                        macros: [
                            { value: "19g", bg: "bg-[#E76F511A]", text: "text-[#E76F51]" },
                            { value: "16g", bg: "bg-[#2A9D8F1A]", text: "text-[#2A9D8F]" },
                            { value: "11g", bg: "bg-[#F4A2611A]", text: "text-[#F4A261]" },
                            { value: "8g", bg: "bg-[#3A86FF1A]", text: "text-[#3A86FF]" },
                        ],
                    },
                ],
            },
            {
                id: 3,
                icon: "/icons/hugeicons_bubble-tea-02.svg",
                options: [
                    {
                        title: "Khichdi with curd",
                        kcal: "260kcal",
                        serving: "1 bowl",
                        macros: [
                            { value: "28g", bg: "bg-[#E76F511A]", text: "text-[#E76F51]" },
                            { value: "17g", bg: "bg-[#2A9D8F1A]", text: "text-[#2A9D8F]" },
                            { value: "13g", bg: "bg-[#F4A2611A]", text: "text-[#F4A261]" },
                            { value: "9g", bg: "bg-[#3A86FF1A]", text: "text-[#3A86FF]" },
                        ],
                    },
                ],
            },
            {
                id: 4,
                icon: "/icons/hugeicons_plant-045.svg",
                options: [
                    {
                        title: "Paneer salad bowl",
                        kcal: "240kcal",
                        serving: "1 bowl",
                        macros: [
                            { value: "22g", bg: "bg-[#E76F511A]", text: "text-[#E76F51]" },
                            { value: "19g", bg: "bg-[#2A9D8F1A]", text: "text-[#2A9D8F]" },
                            { value: "12g", bg: "bg-[#F4A2611A]", text: "text-[#F4A261]" },
                            { value: "10g", bg: "bg-[#3A86FF1A]", text: "text-[#3A86FF]" },
                        ],
                    },
                ],
            },
        ],
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop overlay */}
            <div 
                className="absolute inset-0 bg-black/40"
                onClick={closePopup}
            />
            
            {/* Modal content */}
            <div className="relative  bg-white rounded-[20px] w-[90%] max-w-[725px] max-h-[90vh] overflow-y-auto">
                <button
                    onClick={closePopup}
                    className="absolute top-5 right-5 text-[18px] font-bold text-[#252525] z-10 cursor-pointer hover:opacity-70"
                >
                    ✕
                </button>
                
                <div className=" px-4 py-6">
                    <div className="pl-2.5 pb-[25px] border-b border-[#E1E6ED]">
                        <p className="text-[#252525] text-[25px] font-semibold leading-normal tracking-[-1px]">
                            Edit Diet Plan
                        </p>
                    </div>

                    <div className="mt-1">
                        <div className="w-full rounded-[15px] pt-[15px] pb-2.5 px-2.5 bg-white">
                            {/* HEADER */}
                            <div className="flex items-center justify-between gap-4 flex-wrap px-2.5">
                                <p className="text-[#252525] py-[5px] text-[15px] font-semibold leading-normal tracking-[-0.3px]">
                                    {}
                                </p>

                                <div className="flex items-center gap-[26px] flex-wrap">
                                    {/* DAY SELECTOR */}
                                    <div className="border border-[#E1E6ED] rounded-[10px] flex overflow-hidden">
                                        {days.map((day, index) => {
                                            const dayNumber = index + 1;
                                            const isActive = activeDay === dayNumber;

                                            return (
                                                <div
                                                    key={day}
                                                    onClick={() => setActiveDay(dayNumber)}
                                                    className={`px-4 py-2.5 cursor-pointer ${isActive ? "bg-[#308BF9]" : "bg-white"
                                                        }`}
                                                >
                                                    <p
                                                        className={`text-[12px] font-semibold leading-[110%] tracking-[-0.24px] ${isActive ? "text-white" : "text-[#A1A1A1]"
                                                            }`}
                                                    >
                                                        {day}
                                                    </p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-[3px] mt-[15px]">
                                {/* MEAL LIST */}
                                <div className="flex flex-col gap-[15px] px-[15px] pb-[54px] rounded-[15px] min-w-[180px]">
                                    {meals.map((meal, index) => {
                                        const isActive = activeMeal === meal.name;

                                        return (
                                            <div
                                                key={meal.name}
                                                onClick={() => setActiveMeal(meal.name)}
                                                className={`flex flex-col gap-2.5 py-2.5 pl-[15px] pr-2.5 w-full cursor-pointer ${isActive ? "bg-[#F0F6FD] rounded-[10px]" : ""
                                                    } ${!isActive && index !== 0 ? "border-t border-[#E1E6ED]" : ""}`}
                                            >
                                                <p
                                                    className={`text-[12px] font-semibold leading-[110%] tracking-[-0.48px] ${isActive ? "text-[#252525]" : "text-[#252525]"
                                                        }`}
                                                >
                                                    {meal.name}
                                                </p>

                                                <p
                                                    className={`text-[10px] font-normal leading-normal tracking-[-0.2px] ${isActive ? "text-[#A1A1A1]" : "text-[#A1A1A1]"
                                                        }`}
                                                >
                                                    {meal.time}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* SCROLLABLE DETAILS */}
                                <div className="pt-5 pb-[43px] pl-[15px] pr-2.5 border border-[#F5F7FA] rounded-[15px] flex-1 h-[360px] overflow-y-auto scroll-hide">
                                    <div className="flex flex-col gap-5">
                                        {(mealDetails[activeMeal] || []).map((item) => (
                                            <div key={item.id} className="flex gap-[5px]">
                                                <div className="flex my-[3px] items-start shrink-0">
                                                    <Image
                                                        src={item.icon}
                                                        alt={item.icon}
                                                        width={24}
                                                        height={24}
                                                    />
                                                    <p className="px-[9px] pt-[3px] pb-0.5 text-[#252525] text-[15px] font-bold leading-[126%] tracking-[-0.3px]">
                                                        {item.id}
                                                    </p>
                                                </div>

                                                <div className="flex-1">
                                                    {item.options.map((option, optionIndex) => (
                                                        <div key={optionIndex}>
                                                            <div className="flex flex-col gap-2.5">
                                                                <div className="flex flex-col gap-1 cursor-pointer">
                                                                    <p className="text-[#252525] text-[12px] font-semibold leading-[126%] tracking-[-0.24px]">
                                                                        {option.title}
                                                                    </p>

                                                                    <div className="flex flex-wrap items-center gap-[5px]">
                                                                        {option.kcal && (
                                                                            <p className="text-[#252525] text-[10px] font-normal leading-normal tracking-[-0.2px]">
                                                                                {option.kcal}
                                                                            </p>
                                                                        )}

                                                                        {option.serving && (
                                                                            <p className="text-[#252525] text-[10px] font-normal leading-normal tracking-[-0.2px]">
                                                                                {option.serving}
                                                                            </p>
                                                                        )}

                                                                        <Image
                                                                            src="/icons/hugeicons_information-circle0.svg"
                                                                            alt="hugeicons_information-circle0.svg"
                                                                            width={12}
                                                                            height={12}
                                                                            className="cursor-pointer"
                                                                        />
                                                                    </div>
                                                                </div>

                                                                <div className="flex flex-wrap gap-1">
                                                                    {option.macros.map((macro, macroIndex) => (
                                                                        <div
                                                                            key={macroIndex}
                                                                            className={`px-2.5 py-[5px] rounded-[5px] ${macro.bg}`}
                                                                        >
                                                                            <p
                                                                                className={`${macro.text} text-[10px] font-semibold leading-[110%] tracking-[-0.2px]`}
                                                                            >
                                                                                {macro.value}
                                                                            </p>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>

                                                            {item.options.length > 1 &&
                                                                optionIndex < item.options.length - 1 && (
                                                                    <div className="flex items-center gap-2.5 px-2.5 mt-[17px] mb-[19px]">
                                                                        <div className="flex-1 h-[1px] bg-[#C7C6CE]" />

                                                                        <p className="text-[#252525] text-[12px] font-normal leading-[110%] tracking-[-0.24px]">
                                                                            Or
                                                                        </p>

                                                                        <div className="flex-1 h-[1px] bg-[#C7C6CE]" />
                                                                    </div>
                                                                )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
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