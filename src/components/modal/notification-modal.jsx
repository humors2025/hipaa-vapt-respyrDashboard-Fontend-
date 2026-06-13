

import Image from "next/image";
// import { Modal } from "react-responsive-modal"; // REMOVED

export default function NotificationModal({ open, onClose }) {
    // If 'open' is false, return null to not render the modal
    if (!open) {
        return null;
    }

    // Custom CSS for scrollbar hiding (if you are using a global CSS file or utility that supports it)

    return (
        // Overlay (fixed position, full screen, centered content, dark backdrop, high z-index)
        <div
            className="fixed inset-0 bg-black/40 flex justify-center items-center z-[1000]"
            onClick={onClose} // Replaces closeOnOverlayClick
        >
            {/* Modal Container (replaces <Modal styles={{ modal: {...} }}...>) */}
            <div
                className="rounded-[10px] p-0 overflow-hidden bg-white w-[90%] max-w-[620px] h-[80vh] flex flex-col"
                onClick={(e) => e.stopPropagation()} // Prevents closing when clicking inside the modal
                role="dialog"
                aria-modal="true"
            >
                {/* MAIN WRAPPER */}
                <div className="flex flex-col h-full">

                    {/* ---------------- HEADER ---------------- */}
                    <div className="px-5 bg-white shrink-0">

                        {/* HEADER TITLE AND CLOSE BUTTON */}
                        {/* We use flex and justify-between for alignment and add gap-5 to the bottom boundary */}
                        <div className="flex justify-between items-start pl-[11px] pb-[23px] mt-[31px] border-b border-[#E1E6ED] gap-5">
                            <span className="text-[#252525] text-[25px] font-semibold leading-normal tracking-[-1px]">
                                Notifications
                            </span>
                            {/* CUSTOM CLOSE BUTTON */}
                            <button
                                onClick={onClose}
                                className="shrink-0 bg-white text-[#252525] text-[18px] px-2 py-1 rounded-md shadow cursor-pointer"
                                aria-label="Close"
                            >
                                x
                            </button>
                        </div>

                        <div className="flex gap-2.5 mt-[13px] pb-4">

                            <div className="bg-[#DAEBFF] px-5 py-2 rounded-[20px]">
                                <span className="text-[#308BF9] text-[12px] font-semibold leading-[110%] tracking-[-0.24px]">
                                    All
                                </span>
                            </div>

                            <div className="flex gap-2.5 items-center py-[5px] px-5 rounded-[20px] bg-[#F5F7FA]">
                                <Image src="/icons/hugeicons_alert-circle.svg" width={20} height={20} alt="Alerts" />
                                <span className="text-[#A1A1A1] text-[12px] font-semibold">Alerts</span>
                            </div>

                            <div className="flex gap-2.5 items-center py-[5px] px-5 rounded-[20px] bg-[#F5F7FA]">
                                <Image src="/icons/hugeicons_label-important09.svg" width={20} height={20} alt="Important" />
                                <span className="text-[#A1A1A1] text-[12px] font-semibold">Important</span>
                            </div>

                            <div className="flex gap-2.5 items-center py-[5px] px-5 rounded-[20px] bg-[#F5F7FA]">
                                <Image src="/icons/hugeicons_message-0269.svg" width={20} height={20} alt="Message" />
                                <span className="text-[#A1A1A1] text-[12px] font-semibold">Message</span>
                            </div>
                        </div>
                    </div>

                    {/* ---------------- SCROLLABLE CONTENT ---------------- */}
                    <div className="flex-1 overflow-y-auto px-5 scroll-hide">
                        <div className="flex flex-col gap-2.5 pb-5">

                            {/* ========== TODAY LABEL ========== */}
                            <span className="ml-[11px] mb-[5px] mt-[25px] text-[#535359] text-[12px]">
                                Today
                            </span>

                            {/* ---------- CARD 1 ---------- */}
                            <div className="flex justify-between bg-[#F5F7FA] rounded-[10px] py-3.5 pl-[15px] pr-2.5">
                                <div className="flex gap-[18px] items-center">
                                    <div className="flex items-center">
                                        <div className="relative">

                                            {/* Avatar 1 */}
                                            <div className="w-10 h-10 rounded-full overflow-hidden absolute top-0 left-0">
                                                <Image
                                                    src="https://humorstech.com/dietitian/api/web/get_profile_image.php?profile_id=profile2&dietician_id=RespyrD01"
                                                    width={24}
                                                    height={24}
                                                    alt="User 1"
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>

                                            {/* Avatar 2 */}
                                            <div className="w-10 h-10 rounded-full overflow-hidden absolute top-4 left-4">
                                                <Image
                                                    src="https://humorstech.com/dietitian/api/web/get_profile_image.php?profile_id=profile7&dietician_id=RespyrD01"
                                                    width={24}
                                                    height={24}
                                                    alt="User 2"
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>

                                            {/* Spacer */}
                                            <div className="w-14 h-14"></div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        <p className="text-[#252525] text-[12px] whitespace-nowrap">
                                            5 clients haven't yet taken test!
                                        </p>

                                        <div className="flex gap-[9px] text-[10px]">
                                            <span className="text-[#252525]">Alert</span>
                                            <div className="border border-r border-[#A1A1A1]"></div>
                                            <span className="text-[#535359]">23 minutes ago</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-2.5 items-center px-5 py-[15px]">
                                    <Image src="/icons/hugeicons_alarm-clock.svg" width={20} height={20} alt="Send Reminder" />
                                    <span className="text-[#308BF9] text-[12px] font-semibold whitespace-nowrap">
                                        Send Reminder
                                    </span>
                                </div>
                            </div>

                            {/* ---------- CARD 2 ---------- */}
                            <div className="flex justify-between bg-[#F5F7FA] rounded-[10px] py-3.5 pl-[15px] pr-2.5">
                                <div className="flex gap-[18px] items-center">

                                    <div className="flex items-center">
                                        <div className="relative">

                                            <div className="w-10 h-10 rounded-full overflow-hidden absolute top-0 left-0">
                                                <Image
                                                    src="https://humorstech.com/dietitian/api/web/get_profile_image.php?profile_id=profile2&dietician_id=RespyrD01"
                                                    width={24}
                                                    height={24}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>

                                            <div className="w-10 h-10 rounded-full overflow-hidden absolute top-4 left-4">
                                                <Image
                                                    src="https://humorstech.com/dietitian/api/web/get_profile_image.php?profile_id=profile7&dietician_id=RespyrD01"
                                                    width={24}
                                                    height={24}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>

                                            <div className="w-14 h-14"></div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        <p className="text-[#252525] text-[12px] whitespace-nowrap">
                                            5 clients haven't yet taken test!
                                        </p>

                                        <div className="flex gap-[9px] text-[10px]">
                                            <span className="text-[#252525]">Alert</span>
                                            <div className="border border-r border-[#A1A1A1]"></div>
                                            <span className="text-[#535359]">23 minutes ago</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-2.5 items-center px-5 py-[15px]">
                                    <Image src="/icons/hugeicons_tick-02.svg" width={20} height={20} alt="Reminder Sent" />
                                    <span className="text-[#3FAF58] text-[12px] font-semibold whitespace-nowrap">
                                        Reminder Sent!
                                    </span>
                                </div>
                            </div>

                            {/* --- SINGLE AVATAR CARDS --- */}
                            <div className="bg-[#F5F7FA] rounded-[10px] py-3.5 pl-[15px] pr-2.5">
                                <div className="flex gap-[18px] items-center">
                                    <div className="p-2 bg-[#F0F0F0] rounded-full">
                                        <Image src="/icons/hugeicons_user-circle-02.svg" width={40} height={40} alt="" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <p className="text-[#252525] text-[12px]">
                                            2 clients still yet to receive diet plan
                                        </p>
                                        <div className="flex gap-[9px] text-[10px]">
                                            <span className="text-[#252525]">Important</span>
                                            <div className="border border-r border-[#A1A1A1]"></div>
                                            <span className="text-[#535359]">23 minutes ago</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-[#F5F7FA] rounded-[10px] py-3.5 pl-[15px] pr-2.5">
                                <div className="flex gap-[18px] items-center">
                                    <div className="p-2 bg-[#F0F0F0] rounded-full">
                                        <Image src="/icons/hugeicons_user-circle-02.svg" width={40} height={40} alt="" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <p className="text-[#252525] text-[12px]">
                                            Sagar Hosur has sent 2 new messages
                                        </p>
                                        <div className="flex gap-[9px] text-[10px]">
                                            <span className="text-[#252525]">Messages</span>
                                            <div className="border border-r border-[#A1A1A1]"></div>
                                            <span className="text-[#535359]">23 minutes ago</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ========== YESTERDAY LABEL ========== */}
                            <span className="ml-[11px] mb-[15px] mt-[25px] text-[#535359] text-[12px]">
                                Yesterday
                            </span>

                            {/* --- Yesterday Cards --- */}
                            <div className="bg-[#F5F7FA] rounded-[10px] py-3.5 pl-[15px] pr-2.5">
                                <div className="flex gap-[18px] items-center">
                                    <div className="p-2 bg-[#F0F0F0] rounded-full">
                                        <Image src="/icons/hugeicons_user-circle-02.svg" width={40} height={40} alt="" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <p className="text-[#252525] text-[12px]">
                                            Your subscription plan expires in 21 days
                                        </p>
                                        <div className="flex gap-[9px] text-[10px]">
                                            <span className="text-[#252525]">Messages</span>
                                            <div className="border border-r border-[#A1A1A1]"></div>
                                            <span className="text-[#535359]">12:30pm</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* clone cards same structure */}
                            <div className="bg-[#F5F7FA] rounded-[10px] py-3.5 pl-[15px] pr-2.5">
                                <div className="flex gap-[18px] items-center">
                                    <div className="p-2 bg-[#F0F0F0] rounded-full">
                                        <Image src="/icons/hugeicons_user-circle-02.svg" width={40} height={40} alt="" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <p className="text-[#252525] text-[12px]">
                                            2 clients still yet to receive diet plan
                                        </p>
                                        <div className="flex gap-[9px] text-[10px]">
                                            <span className="text-[#252525]">Alert</span>
                                            <div className="border border-r border-[#A1A1A1]"></div>
                                            <span className="text-[#535359]">11am</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* You had one more duplicate block — keeping it */}
                            <div className="bg-[#F5F7FA] rounded-[10px] py-3.5 pl-[15px] pr-2.5">
                                <div className="flex gap-[18px] items-center">
                                    <div className="p-2 bg-[#F0F0F0] rounded-full">
                                        <Image src="/icons/hugeicons_user-circle-02.svg" width={40} height={40} alt="" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <p className="text-[#252525] text-[12px]">
                                            2 clients still yet to receive diet plan
                                        </p>
                                        <div className="flex gap-[9px] text-[10px]">
                                            <span className="text-[#252525]">Alert</span>
                                            <div className="border border-r border-[#A1A1A1]"></div>
                                            <span className="text-[#535359]">11am</span>
                                        </div>
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