"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { IoIosArrowForward } from "react-icons/io";
import Cookies from "js-cookie";

export default function ProfileSettings() {
  const [activeItem, setActiveItem] = useState("Account");

  // ✅ form state
  const [form, setForm] = useState({
    name: "",
    reference: "",
    mobile: "",
    email: "",
  });

  // ✅ sidebar menu
  const menuItems = [
    { id: "Account", label: "Account", disabled: false },
    { id: "Subscription", label: "Subscription", disabled: true },
    { id: "Security", label: "Security", disabled: true },
    { id: "Help Center", label: "Help Center", disabled: true },
    { id: "About", label: "About", disabled: true },
  ];

  const inputBg = (value) => (value ? "bg-[#F5F7FA]" : "bg-white");

  const handleItemClick = (itemId, disabled) => {
    if (disabled) return;
    setActiveItem(itemId);
  };

  // ✅ read dietician cookie
  useEffect(() => {
    const DIETICIAN_COOKIE_KEY = "dietician";

    const raw = Cookies.get(DIETICIAN_COOKIE_KEY);
    if (!raw) return;

    let dietician;
    try {
      dietician = JSON.parse(raw);
    } catch {
      dietician = raw;
    }

    setForm({
      name: dietician?.name || dietician?.dietician_name || "",
      reference: dietician?.dietician_id || dietician?.id || "",
      mobile:
        dietician?.mobile ||
        dietician?.phone ||
        dietician?.phone_no ||
        "",
      email: dietician?.email || "",
    });
  }, []);

  const onChange = (e) => {
    const { id, value } = e.target;
    setForm((p) => ({ ...p, [id]: value }));
  };

  const copyText = async (text) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  };

  return (
    <div className="flex gap-[27px] pt-[25px] pl-[23px] pr-5 bg-white rounded-[15px] min-h-[calc(100vh-50px)] overflow-hidden">
      {/* LEFT MENU */}
      <div>
        {menuItems.map((item) => {
          const isActive = activeItem === item.id;
          const isDisabled = item.disabled;

          const bgClass = isActive ? "bg-[#E1E6ED]" : "";
          const textColor = isDisabled
            ? "text-[#A1A1A1]"
            : isActive
            ? "text-[#308BF9]"
            : "text-[#252525]";

          const arrowColor = isDisabled
            ? "text-[#A1A1A1]"
            : isActive
            ? "text-[#308BF9]"
            : "text-[#252525]";

          return (
            <div
              key={item.id}
              className={`w-[303px] pl-[23px] pr-[15px] py-[22px] rounded-[5px] flex items-center
                ${bgClass}
                ${isDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}
              `}
              onClick={() => handleItemClick(item.id, isDisabled)}
            >
              <span
                className={`flex-1 text-[15px] font-semibold leading-[110%] tracking-[-0.3px] ${textColor}`}
              >
                {item.label}
              </span>

              <IoIosArrowForward className={`${arrowColor} ml-auto`} />
            </div>
          );
        })}
      </div>

      {/* RIGHT CONTENT */}
      <div className="flex flex-col gap-6 w-full overflow-y-auto">
        <div className="pl-[15px] pb-[18px] pr-3.5 border-b border-[#E1E6ED]">
          <span className="text-[#252525] text-[20px] font-semibold leading-[110%] tracking-[-0.4px]">
            Account
          </span>
        </div>

        <div className="form-container">
          {/* NAME */}
          <div className="input-group">
            <input
              type="text"
              id="name"
              className={`form-input ${inputBg(form.name)}`}
              placeholder=" "
              value={form.name}
              onChange={onChange}
              readOnly
            />
            <label htmlFor="name" className="form-label">
              Name
            </label>
          </div>

          {/* REFERENCE */}
          <div className="input-group relative">
            <input
              type="text"
              id="reference"
              className={`form-input ${inputBg(form.reference)}`}
              placeholder=" "
              value={form.reference}
              readOnly
            />
            <label htmlFor="reference" className="form-label">
              Reference Id
            </label>

            <div
              onClick={() => copyText(form.reference)}
              className="absolute right-[10px] top-1/2 -translate-y-1/2 cursor-pointer"
            >
              <Image
                src="/icons/hugeicons_copy-02.svg"
                alt="Copy reference"
                width={15}
                height={15}
              />
            </div>
          </div>

          {/* MOBILE */}
          <div className="input-group relative">
            <input
              type="text"
              id="mobile"
              className={`form-input ${inputBg(form.mobile)}`}
              placeholder=" "
              value={form.mobile}
              onChange={onChange}
              readOnly
            />
            <label htmlFor="mobile" className="form-label">
              Mobile Number
            </label>

            <div
              onClick={() => copyText(form.mobile)}
              className="absolute right-[10px] top-1/2 -translate-y-1/2 cursor-pointer"
            >
              <Image
                src="/icons/hugeicons_copy-02.svg"
                alt="Copy mobile"
                width={15}
                height={15}
              />
            </div>
          </div>

          {/* EMAIL */}
          <div className="input-group relative">
            <input
              type="text"
              id="email"
              className={`form-input ${inputBg(form.email)}`}
              placeholder=" "
              value={form.email}
              readOnly
            />
            <label htmlFor="email" className="form-label">
              Email Address
            </label>

            <div
              onClick={() => copyText(form.email)}
              className="absolute right-[10px] top-1/2 -translate-y-1/2 cursor-pointer"
            >
              <Image
                src="/icons/hugeicons_copy-02.svg"
                alt="Copy email"
                width={15}
                height={15}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
