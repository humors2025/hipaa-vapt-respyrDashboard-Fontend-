

"use client";

import Link from "next/link";
import React, { useState } from "react";
import { loginService, updateDietPlanStatusService, fetchAdminGroupsService } from "@/services/authService";
import { cookieManager } from "@/lib/cookies";
import { persistLoginResponse, landingPathForUser, getCurrentUser, ROLES } from "@/lib/user";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useDispatch } from "react-redux";
import { setAdminGroups, clearAdminGroups } from "@/store/adminGroupsSlice";

// Map ?role= query param → headline copy. Invite emails include the param so
// the recipient lands on a heading that matches their role. Default (no param)
// is the generic "Welcome!".
const ROLE_HEADINGS = {
  super_admin: "Welcome Super-Admin!",
  admin: "Welcome Trainer-Admin!",
  trainer_admin: "Welcome Trainer-Admin!",
  trainer: "Welcome Trainer!",
  client: "Welcome!",
};

export function LoginForm({ className, ...props }) {
  const router = useRouter();
  const dispatch = useDispatch();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get("role");
  const heading = ROLE_HEADINGS[roleParam] || "Welcome!";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [inputError, setInputError] = useState("");

  const B2B2C = ["Qua", "RespyrD01"];

  // const handleSubmit = async (e) => {
  //   e.preventDefault();
  //   setLoading(true);

  //   try {
  //     const res = await loginService(email, password);

  //     cookieManager.set("access_token", res.access_token);
  //     cookieManager.set("dietician", JSON.stringify(res.dietician));

  //     try {
  //       await updateDietPlanStatusService(res?.dietician?.dietician_id);
  //     } catch (dietPlanError) {
  //       console.error("Diet plan status update failed:", dietPlanError);
  //     }

  //     toast.success(`Welcome ${res?.dietician?.name || ""}`, {
  //       description: "You have logged in successfully",
  //     });

  //     const dieticianId = res?.dietician?.dietician_id || "";

  //     // ✅ Routing logic:
  //     // RespyrD01 and Qua -> /partners/dashboard
  //     // everyone else -> /dashboard
  //     if (B2B2C.includes(dieticianId)) {
  //       router.push("/partners/dashboard");
  //     } else {
  //       router.push("/dashboard");
  //     }
  //   } catch (error) {
  //     let errorMessage = "Invalid credentials";

  //     if (error?.isApiError) {
  //       errorMessage =
  //         error.message || error.data?.error || "Invalid credentials";
  //     }

  //     setInputError(errorMessage);
  //     toast.error(errorMessage);
  //   } finally {
  //     setLoading(false);
  //   }
  // };



const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);

  try {
    const res = await loginService(email, password);

    // Pull is_reset_password from whichever shape the backend returned.
    // New shape: res.user.is_reset_password. Legacy: res.dietician.is_reset_password.
    const isResetPassword =
      res?.user?.is_reset_password ?? res?.dietician?.is_reset_password;

    // First-login password update gate: don't issue access_token yet.
    if (isResetPassword === 0) {
      toast.error("Please update your password before logging in.");
      // Persist user info (without access_token) so the update-password page
      // can identify who's resetting. Mirrors prior behavior.
      if (res?.dietician) {
        cookieManager.set("dietician", JSON.stringify(res.dietician));
      }
      if (res?.user) {
        cookieManager.set("user", JSON.stringify(res.user));
      }
      router.push("/trainer/updatepassword");
      setLoading(false);
      return;
    }

    // Persist access_token + both cookie shapes (new + legacy mirror).
    persistLoginResponse(res);

    // Best-effort: fetch the admin groups the user can manage. actor_user_id is
    // decoded from the access_token cookie inside the service. Non-blocking so a
    // failure here never prevents the user from landing on their dashboard.
    // TA Analytics is gated on having at least one group: when the response's
    // `groups` array is non-empty we flag it so TrainerAdminHeader shows the
    // tab; an empty array (or any failure) clears the flag and hides the tab.
    // Only trainer-admins can hit manage_admin_groups.php — the backend rejects
    // everyone else with "Only an admin can access admin groups", so skip the
    // call entirely for other roles.
    const currentUser = getCurrentUser();
    if (currentUser?.role === ROLES.TRAINER_ADMIN) {
      try {
        const adminGroupsRes = await fetchAdminGroupsService();
        // Store the full response in Redux so the trainer-admin AnalyticsDashboard
        // can consume it after the client-side navigation below.
        dispatch(setAdminGroups(adminGroupsRes));
        const hasGroups = Array.isArray(adminGroupsRes?.groups) && adminGroupsRes.groups.length > 0;
        if (hasGroups) {
          cookieManager.set("ta_analytics_enabled", "1");
        } else {
          cookieManager.remove("ta_analytics_enabled");
        }
      } catch (adminGroupsError) {
        console.error("Fetch admin groups failed:", adminGroupsError);
        dispatch(clearAdminGroups());
        cookieManager.remove("ta_analytics_enabled");
      }
    } else {
      dispatch(clearAdminGroups());
      cookieManager.remove("ta_analytics_enabled");
    }

    // Best-effort: existing diet-plan-status side effect. Use whichever id
    // the response provides (falls back through legacy).
    const userIdForSideEffect =
      res?.user?.partner_code ||
      res?.user?.user_id ||
      res?.dietician?.dietician_id;
    try {
      if (userIdForSideEffect) {
        await updateDietPlanStatusService(userIdForSideEffect);
      }
    } catch (dietPlanError) {
      console.error("Diet plan status update failed:", dietPlanError);
    }

    // Welcome toast — prefer first_name when the new shape is available.
    const greetingName =
      res?.user?.first_name ||
      res?.dietician?.name ||
      "";
    toast.success(`Welcome ${greetingName}`, {
      description: "You have logged in successfully",
    });

    // Role-aware routing. landingPathForUser returns the right path for
    // the user's role; for trainers (the only role that exists today) it
    // preserves the historic Qua-vs-partners split so behavior is unchanged.
    router.push(landingPathForUser(currentUser));

  } catch (error) {
    let errorMessage = "Invalid credentials";

    if (error?.isApiError) {
      errorMessage =
        error.message || error.data?.error || "Invalid credentials";
    }

    setInputError(errorMessage);
    toast.error(errorMessage);
  } finally {
    setLoading(false);
  }
};







  const togglePasswordVisibility = () => {
    setShowPassword((v) => !v);
  };

  return (
    <div className="flex items-center justify-start">
      <div className="w-full max-w-md bg-white shadow-lg px-[62px] pt-[60px] pb-[54px]">
        <h2 className="text-[34px] font-normal leading-normal tracking-[-2.04] text-[#252525] text-center whitespace-nowrap">
          {heading}
        </h2>

        <form onSubmit={handleSubmit} className="mt-[73px] space-y-4">
          <div className="relative">
            <input
              id="email"
              type="email"
              placeholder=" "
              value={email}
              autoComplete="false"
              onChange={(e) => {
                setEmail(e.target.value);
                setInputError("");
              }}
              required
              className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-1 
                focus:ring-[#E1E6ED] peer 
                ${inputError ? "border-[#DA5747]" : "border-gray-300"}`}
            />
            <label
              htmlFor="email"
              className="absolute left-3 top-3 text-[#A1A1A1] transition-all duration-200 pointer-events-none 
                peer-placeholder-shown:top-3 peer-placeholder-shown:text-base 
                peer-focus:top-[-10px] peer-focus:text-[12px] peer-focus:text-[#252525]
                peer-not-placeholder-shown:top-[-10px] peer-not-placeholder-shown:text-sm
                bg-white px-1"
            >
              Enter Email ID
            </label>
          </div>

          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder=" "
              value={password}
              autoComplete="false"
              onChange={(e) => {
                setPassword(e.target.value);
                setInputError("");
              }}
              required
              className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-1 
                focus:ring-[#E1E6ED] peer pr-10
                ${inputError ? "border-[#DA5747]" : "border-gray-300"}`}
            />
            <label
              htmlFor="password"
              className="absolute left-3 top-3 text-[#A1A1A1] transition-all duration-200 pointer-events-none 
                peer-placeholder-shown:top-3 peer-placeholder-shown:text-base 
                peer-focus:top-[-10px] peer-focus:text-[12px] peer-focus:text-[#252525]
                peer-not-placeholder-shown:top-[-10px] peer-not-placeholder-shown:text-sm
                bg-white px-1"
            >
              Enter password
            </label>

            <div
              className="absolute right-3 top-4 cursor-pointer"
              onClick={togglePasswordVisibility}
            >
              <Image
                src="/icons/hugeicons_view.svg"
                alt={showPassword ? "Hide password" : "Show password"}
                width={15}
                height={15}
                className={showPassword ? "opacity-50" : "opacity-100"}
              />
            </div>

            <Link
              href="/resetPassword"
              className="flex justify-end mt-1 mb-[92px] text-[#A1A1A1] text-[12px] font-normal leading-[110%] tracking-[-0.24px] hover:underline"
            >
              Forgot password?
            </Link>

            {inputError && (
              <p className="text-[#DA5747] text-[12px] mt-1 absolute -bottom-6">
                {inputError}
              </p>
            )}
          </div>

          <p className="text-[#A1A1A1] text-[12px] font-normal leading-[110%] tracking-[-0.24px] whitespace-nowrap">
            By continuing, you agree to our{" "}
            <a
              href="https://respyr.in/terms-conditions/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Terms
            </a>{" "}
            and{" "}
            <a
              href="https://respyr.in/privacy_policy/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Privacy Policy
            </a>
            .
          </p>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-5 cursor-pointer bg-[#308BF9] text-white py-[15px] px-[93px] rounded-lg font-semibold border border-transparent hover:bg-white hover:text-[#252525] hover:border-[#308BF9] transition disabled:opacity-60"
          >
            {loading ? "Continue in..." : "Continue"}
          </button>

          {/* <p className="text-[#535359] text-[12px] text-center mt-3">
            Have an invite?{" "}
            <Link href="/signup" className="text-[#308BF9] font-semibold hover:underline">
              Sign up here
            </Link>
          </p> */}
        </form>
      </div>
    </div>
  );
}











// "use client";

// import Link from "next/link";
// import React, { useState } from "react";
// import { loginService, updateDietPlanStatusService } from "@/services/authService";
// import { cookieManager } from "@/lib/cookies";
// import { persistLoginResponse, landingPathForUser, getCurrentUser } from "@/lib/user";
// import { toast } from "sonner";
// import { useRouter, useSearchParams } from "next/navigation";
// import Image from "next/image";

// // Map ?role= query param → headline copy. Invite emails include the param so
// // the recipient lands on a heading that matches their role. Default (no param)
// // is the generic "Welcome!".
// const ROLE_HEADINGS = {
//   super_admin: "Welcome Super-Admin!",
//   admin: "Welcome Trainer-Admin!",
//   trainer_admin: "Welcome Trainer-Admin!",
//   trainer: "Welcome Trainer!",
//   client: "Welcome!",
// };

// export function LoginForm({ className, ...props }) {
//   const router = useRouter();
//   const searchParams = useSearchParams();
//   const roleParam = searchParams.get("role");
//   const heading = ROLE_HEADINGS[roleParam] || "Welcome!";

//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [loading, setLoading] = useState(false);
//   const [showPassword, setShowPassword] = useState(false);
//   const [inputError, setInputError] = useState("");

//   const B2B2C = ["Qua", "RespyrD01"];


// const handleSubmit = async (e) => {
//   e.preventDefault();
//   setLoading(true);

//   try {
//     const res = await loginService(email, password);

//     // Pull is_reset_password from whichever shape the backend returned.
//     // New shape: res.user.is_reset_password. Legacy: res.dietician.is_reset_password.
//     const isResetPassword =
//       res?.user?.is_reset_password ?? res?.dietician?.is_reset_password;

//     // First-login password update gate: don't issue access_token yet.
//     if (isResetPassword === 0) {
//       toast.error("Please update your password before logging in.");
//       // Persist user info (without access_token) so the update-password page
//       // can identify who's resetting. Mirrors prior behavior.
//       if (res?.dietician) {
//         cookieManager.set("dietician", JSON.stringify(res.dietician));
//       }
//       if (res?.user) {
//         cookieManager.set("user", JSON.stringify(res.user));
//       }
//       router.push("/trainer/updatepassword");
//       setLoading(false);
//       return;
//     }

//     // Persist access_token + both cookie shapes (new + legacy mirror).
//     persistLoginResponse(res);

//     // Best-effort: existing diet-plan-status side effect. Use whichever id
//     // the response provides (falls back through legacy).
//     const userIdForSideEffect =
//       res?.user?.partner_code ||
//       res?.user?.user_id ||
//       res?.dietician?.dietician_id;
//     try {
//       if (userIdForSideEffect) {
//         await updateDietPlanStatusService(userIdForSideEffect);
//       }
//     } catch (dietPlanError) {
//       console.error("Diet plan status update failed:", dietPlanError);
//     }

//     // Welcome toast — prefer first_name when the new shape is available.
//     const greetingName =
//       res?.user?.first_name ||
//       res?.dietician?.name ||
//       "";
//     toast.success(`Welcome ${greetingName}`, {
//       description: "You have logged in successfully",
//     });

//     // Role-aware routing. landingPathForUser returns the right path for
//     // the user's role; for trainers (the only role that exists today) it
//     // preserves the historic Qua-vs-partners split so behavior is unchanged.
//     const user = getCurrentUser();
//     router.push(landingPathForUser(user));

//   } catch (error) {
//     let errorMessage = "Invalid credentials";

//     if (error?.isApiError) {
//       errorMessage =
//         error.message || error.data?.error || "Invalid credentials";
//     }

//     setInputError(errorMessage);
//     toast.error(errorMessage);
//   } finally {
//     setLoading(false);
//   }
// };







//   const togglePasswordVisibility = () => {
//     setShowPassword((v) => !v);
//   };

//   return (
//     <div className="flex items-center justify-start">
//       <div className="w-full max-w-md bg-white shadow-lg px-[62px] pt-[60px] pb-[54px]">
//         <h2 className="text-[34px] font-normal leading-normal tracking-[-2.04] text-[#252525] text-center whitespace-nowrap">
//           {heading}
//         </h2>

//         <form onSubmit={handleSubmit} className="mt-[73px] space-y-4">
//           <div className="relative">
//             <input
//               id="email"
//               type="email"
//               placeholder=" "
//               value={email}
//               autoComplete="false"
//               onChange={(e) => {
//                 setEmail(e.target.value);
//                 setInputError("");
//               }}
//               required
//               className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-1 
//                 focus:ring-[#E1E6ED] peer 
//                 ${inputError ? "border-[#DA5747]" : "border-gray-300"}`}
//             />
//             <label
//               htmlFor="email"
//               className="absolute left-3 top-3 text-[#A1A1A1] transition-all duration-200 pointer-events-none 
//                 peer-placeholder-shown:top-3 peer-placeholder-shown:text-base 
//                 peer-focus:top-[-10px] peer-focus:text-[12px] peer-focus:text-[#252525]
//                 peer-not-placeholder-shown:top-[-10px] peer-not-placeholder-shown:text-sm
//                 bg-white px-1"
//             >
//               Enter Email ID
//             </label>
//           </div>

//           <div className="relative">
//             <input
//               id="password"
//               type={showPassword ? "text" : "password"}
//               placeholder=" "
//               value={password}
//               autoComplete="false"
//               onChange={(e) => {
//                 setPassword(e.target.value);
//                 setInputError("");
//               }}
//               required
//               className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-1 
//                 focus:ring-[#E1E6ED] peer pr-10
//                 ${inputError ? "border-[#DA5747]" : "border-gray-300"}`}
//             />
//             <label
//               htmlFor="password"
//               className="absolute left-3 top-3 text-[#A1A1A1] transition-all duration-200 pointer-events-none 
//                 peer-placeholder-shown:top-3 peer-placeholder-shown:text-base 
//                 peer-focus:top-[-10px] peer-focus:text-[12px] peer-focus:text-[#252525]
//                 peer-not-placeholder-shown:top-[-10px] peer-not-placeholder-shown:text-sm
//                 bg-white px-1"
//             >
//               Enter password
//             </label>

//             <div
//               className="absolute right-3 top-4 cursor-pointer"
//               onClick={togglePasswordVisibility}
//             >
//               <Image
//                 src="/icons/hugeicons_view.svg"
//                 alt={showPassword ? "Hide password" : "Show password"}
//                 width={15}
//                 height={15}
//                 className={showPassword ? "opacity-50" : "opacity-100"}
//               />
//             </div>

//             <Link
//               href="/resetPassword"
//               className="flex justify-end mt-1 mb-[92px] text-[#A1A1A1] text-[12px] font-normal leading-[110%] tracking-[-0.24px] hover:underline"
//             >
//               Forgot password?
//             </Link>

//             {inputError && (
//               <p className="text-[#DA5747] text-[12px] mt-1 absolute -bottom-6">
//                 {inputError}
//               </p>
//             )}
//           </div>

//           <p className="text-[#A1A1A1] text-[12px] font-normal leading-[110%] tracking-[-0.24px] whitespace-nowrap">
//             By continuing, you agree to our{" "}
//             <a
//               href="https://respyr.in/terms-conditions/"
//               target="_blank"
//               rel="noopener noreferrer"
//               className="underline"
//             >
//               Terms
//             </a>{" "}
//             and{" "}
//             <a
//               href="https://respyr.in/privacy_policy/"
//               target="_blank"
//               rel="noopener noreferrer"
//               className="underline"
//             >
//               Privacy Policy
//             </a>
//             .
//           </p>

//           <button
//             type="submit"
//             disabled={loading}
//             className="w-full mt-5 cursor-pointer bg-[#308BF9] text-white py-[15px] px-[93px] rounded-lg font-semibold border border-transparent hover:bg-white hover:text-[#252525] hover:border-[#308BF9] transition disabled:opacity-60"
//           >
//             {loading ? "Continue in..." : "Continue"}
//           </button>

//           {/* <p className="text-[#535359] text-[12px] text-center mt-3">
//             Have an invite?{" "}
//             <Link href="/signup" className="text-[#308BF9] font-semibold hover:underline">
//               Sign up here
//             </Link>
//           </p> */}
//         </form>
//       </div>
//     </div>
//   );
// }








// "use client";

// import Link from "next/link";
// import React, { useState } from "react";
// import { loginService, updateDietPlanStatusService } from "@/services/authService";
// import { cookieManager } from "@/lib/cookies";
// import { toast } from "sonner";
// import { useRouter } from "next/navigation";
// import Image from "next/image";

// export function LoginForm({ className, ...props }) {
//   const router = useRouter();
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [loading, setLoading] = useState(false);
//   const [showPassword, setShowPassword] = useState(false);
//   const [inputError, setInputError] = useState("");

//   const B2B2C = ["Qua", "RespyrD01"];

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     setLoading(true);

//     try {
//       const res = await loginService(email, password);

//       cookieManager.set("access_token", res.access_token);
//       cookieManager.set("dietician", JSON.stringify(res.dietician));

//       try {
//         await updateDietPlanStatusService(res?.dietician?.dietician_id);
//       } catch (dietPlanError) {
//         console.error("Diet plan status update failed:", dietPlanError);
//       }

//       toast.success(`Welcome ${res?.dietician?.name || ""}`, {
//         description: "You have logged in successfully",
//       });

//       const dieticianId = res?.dietician?.dietician_id || "";

//       // ✅ Routing logic:
//       // RespyrD01 and Qua -> /partners/dashboard
//       // everyone else -> /dashboard
//       if (B2B2C.includes(dieticianId)) {
//         router.push("/partners/dashboard");
//       } else {
//         router.push("/dashboard");
//       }
//     } catch (error) {
//       let errorMessage = "Invalid credentials";

//       if (error?.isApiError) {
//         errorMessage =
//           error.message || error.data?.error || "Invalid credentials";
//       }

//       setInputError(errorMessage);
//       toast.error(errorMessage);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const togglePasswordVisibility = () => {
//     setShowPassword((v) => !v);
//   };

//   return (
//     <div className="flex items-center justify-start">
//       <div className="w-full max-w-md bg-white shadow-lg px-[62px] pt-[60px] pb-[54px]">
//         <h2 className="text-[34px] font-normal leading-normal tracking-[-2.04] text-[#252525] text-center whitespace-nowrap">
//           Welcome Dietician!
//         </h2>

//         <form onSubmit={handleSubmit} className="mt-[73px] space-y-4">
//           <div className="relative">
//             <input
//               id="email"
//               type="email"
//               placeholder=" "
//               value={email}
//               autoComplete="false"
//               onChange={(e) => {
//                 setEmail(e.target.value);
//                 setInputError("");
//               }}
//               required
//               className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-1 
//                 focus:ring-[#E1E6ED] peer 
//                 ${inputError ? "border-[#DA5747]" : "border-gray-300"}`}
//             />
//             <label
//               htmlFor="email"
//               className="absolute left-3 top-3 text-[#A1A1A1] transition-all duration-200 pointer-events-none 
//                 peer-placeholder-shown:top-3 peer-placeholder-shown:text-base 
//                 peer-focus:top-[-10px] peer-focus:text-[12px] peer-focus:text-[#252525]
//                 peer-not-placeholder-shown:top-[-10px] peer-not-placeholder-shown:text-sm
//                 bg-white px-1"
//             >
//               Enter Dietician ID
//             </label>
//           </div>

//           <div className="relative">
//             <input
//               id="password"
//               type={showPassword ? "text" : "password"}
//               placeholder=" "
//               value={password}
//               autoComplete="false"
//               onChange={(e) => {
//                 setPassword(e.target.value);
//                 setInputError("");
//               }}
//               required
//               className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-1 
//                 focus:ring-[#E1E6ED] peer pr-10
//                 ${inputError ? "border-[#DA5747]" : "border-gray-300"}`}
//             />
//             <label
//               htmlFor="password"
//               className="absolute left-3 top-3 text-[#A1A1A1] transition-all duration-200 pointer-events-none 
//                 peer-placeholder-shown:top-3 peer-placeholder-shown:text-base 
//                 peer-focus:top-[-10px] peer-focus:text-[12px] peer-focus:text-[#252525]
//                 peer-not-placeholder-shown:top-[-10px] peer-not-placeholder-shown:text-sm
//                 bg-white px-1"
//             >
//               Enter password
//             </label>

//             <div
//               className="absolute right-3 top-4 cursor-pointer"
//               onClick={togglePasswordVisibility}
//             >
//               <Image
//                 src="/icons/hugeicons_view.svg"
//                 alt={showPassword ? "Hide password" : "Show password"}
//                 width={15}
//                 height={15}
//                 className={showPassword ? "opacity-50" : "opacity-100"}
//               />
//             </div>

//             <Link
//               href="/resetPassword"
//               className="flex justify-end mt-1 mb-[92px] text-[#A1A1A1] text-[12px] font-normal leading-[110%] tracking-[-0.24px] hover:underline"
//             >
//               Forgot password?
//             </Link>

//             {inputError && (
//               <p className="text-[#DA5747] text-[12px] mt-1 absolute -bottom-6">
//                 {inputError}
//               </p>
//             )}
//           </div>

//           <p className="text-[#A1A1A1] text-[12px] font-normal leading-[110%] tracking-[-0.24px] whitespace-nowrap">
//             By continuing, you agree to our{" "}
//             <a
//               href="https://respyr.in/terms-conditions/"
//               target="_blank"
//               rel="noopener noreferrer"
//               className="underline"
//             >
//               Terms
//             </a>{" "}
//             and{" "}
//             <a
//               href="https://respyr.in/privacy_policy/"
//               target="_blank"
//               rel="noopener noreferrer"
//               className="underline"
//             >
//               Privacy Policy
//             </a>
//             .
//           </p>

//           <button
//             type="submit"
//             disabled={loading}
//             className="w-full mt-5 cursor-pointer bg-[#308BF9] text-white py-[15px] px-[93px] rounded-lg font-semibold border border-transparent hover:bg-white hover:text-[#252525] hover:border-[#308BF9] transition disabled:opacity-60"
//           >
//             {loading ? "Continue in..." : "Continue"}
//           </button>
//         </form>
//       </div>
//     </div>
//   );
// }
