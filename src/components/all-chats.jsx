import { useState, useMemo } from "react";
import { UserProfile } from "./user-profile";
import Image from "next/image";

export default function AllChats() {
  const [chats, setChats] = useState([
    { name: "Sagar Hosur", message: "Lorem ipsum dolor sit amet consectetur sit amet consectetur..", badgeCount: 1, isRead: false },
    { name: "Manoranjan", message: "Another sample message that is too long and needs trimming...", badgeCount: 2, isRead: false },
    { name: "lorem", message: "Another sample message that is too long and needs trimming...", isRead: true },
    { name: "Manoranjan", message: "Another sample message that is too long and needs trimming...", isRead: true },
    { name: "Manoranjan", message: "Another sample message that is too long and needs trimming...", badgeCount: 2, isRead: false },
    { name: "Manoranjan", message: "Another sample message that is too long and needs trimming...", isRead: true },
    { name: "Manoranjan", message: "Another sample message that is too long and needs trimming...", badgeCount: 2, isRead: false },
    { name: "Manoranjan", message: "Another sample message that is too long and needs trimming...", badgeCount: 2, isRead: false },
    { name: "Manoranjan", message: "Another sample message that is too long and needs trimming...", badgeCount: 2, isRead: false },
    { name: "Manoranjan", message: "Another sample message that is too long and needs trimming...", badgeCount: 2, isRead: false },
    { name: "Manoranjan", message: "Another sample message that is too long and needs trimming...", badgeCount: 2, isRead: false },
    { name: "Manoranjan", message: "Another sample message that is too long and needs trimming...", badgeCount: 2, isRead: false },
    { name: "Manoranjan", message: "Another sample message that is too long and needs trimming...", badgeCount: 2, isRead: false },
    { name: "Manoranjan", message: "Another sample message that is too long and needs trimming...", badgeCount: 2, isRead: false },
    { name: "Manoranjan", message: "Another sample message that is too long and needs trimming...", badgeCount: 2, isRead: false },
    { name: "Manoranjan", message: "Another sample message that is too long and needs trimming...", badgeCount: 2, isRead: false },
  ]);

  const [search, setSearch] = useState("");

  const filteredChats = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return chats;
    return chats.filter((c) => c.name.toLowerCase().includes(q));
  }, [search, chats]);

  const markAsRead = (index) => {
    setChats((prev) =>
      prev.map((chat, i) =>
        i === index ? { ...chat, isRead: true, badgeCount: 0 } : chat
      )
    );
  };

  return (
    <>
      <div className="h-[80vh] flex flex-col">
        <div className="rounded-t-[15px] bg-white">
          <div className="ml-[15px] mt-[25px]">
            <p className="text-[#252525] text-[15px] font-semibold tracking-[-0.3px] leading-[110%]">
              All Chats
            </p>
          </div>
          <div>
            {/* Pass search + handler so the messages search bar controls filtering */}
            <UserProfile searchQuery={search} onSearchChange={setSearch} />
          </div>
        </div>

        {/* Chats list with scroll */}
        <div className="flex-1 overflow-y-auto max-h-[calc(19*64px)] hide-scrollbar">
          {filteredChats.map((chat, index) => (
            <div
              key={`${chat.name}-${index}`}
              onClick={() => markAsRead(index)}
              className={`flex items-center gap-2 px-[15px] py-3.5 cursor-pointer ${
                chat.isRead ? "bg-white" : "bg-[#EAF3FF]"
              }`}
            >
              <div className="p-2 bg-[#F0F0F0] rounded-full shrink-0">
                <Image
                  src="/icons/hugeicons_user-circle-02.svg"
                  alt="hugeicons_user-circle"
                  width={24}
                  height={24}
                />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-[#252525] text-[12px] font-semibold leading-[126%] tracking-[-0.24px]">
                  {chat.name}
                </p>
                <p className="text-[#535359] text-[10px] font-normal leading-normal tracking-[-0.2px] truncate max-w-[calc(100%-20px)]">
                  {chat.message.length > 30
                    ? chat.message.slice(0, 30) + "..."
                    : chat.message}
                </p>
              </div>

              {!chat.isRead && chat.badgeCount > 0 && (
                <div className="ml-auto flex items-center justify-center w-5 h-5 bg-[#308BF9] rounded-full shrink-0">
                  <p className="text-white text-center text-[10px] font-normal leading-normal tracking-[-0.2px]">
                    {chat.badgeCount}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
