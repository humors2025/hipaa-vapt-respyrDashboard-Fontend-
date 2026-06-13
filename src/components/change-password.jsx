

"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { updatePasswordService } from "@/services/authService";
import { toast } from "sonner";

function PasswordRule({ label, active }) {
  return (
    <li
      className={`flex items-center gap-2 ${
        active ? "text-green-600" : "text-[#6B7280]"
      }`}
    >
      <span className="text-[12px]">{active ? "✔" : "✖"}</span>
      <span className="text-[12px]">{label}</span>
    </li>
  );
}

export default function ChangePassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [dieticianId, setDieticianId] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const togglePasswordVisibility = () => setShowPassword((p) => !p);
  const toggleConfirmPasswordVisibility = () =>
    setShowConfirmPassword((p) => !p);

  const passwordRules = {
    minLength: (pwd) => pwd.length >= 8,
    lowercase: (pwd) => /[a-z]/.test(pwd),
    uppercase: (pwd) => /[A-Z]/.test(pwd),
    numbers: (pwd) => /\d/.test(pwd),
    special: (pwd) => /[^A-Za-z\d]/.test(pwd),
  };

  const isStrongPassword = (pwd) => {
    return (
      passwordRules.minLength(pwd) &&
      passwordRules.lowercase(pwd) &&
      passwordRules.uppercase(pwd) &&
      passwordRules.numbers(pwd) &&
      passwordRules.special(pwd)
    );
  };

  // Function to clear cookies
  const clearCookies = () => {
    // Clear specific cookies by setting them to expire in the past
    const cookies = ['dietician', 'access_token', 'refresh_token']; // Add all cookies you want to clear
    
    cookies.forEach(cookieName => {
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    });
    
  };

  useEffect(() => {
    const getCookie = (name) => {
      if (typeof document === "undefined") return "";
      const match = document.cookie.match(
        new RegExp("(^| )" + name + "=([^;]+)")
      );
      return match ? match[2] : "";
    };

    const parseCookieJSON = (raw) => {
      if (!raw) return null;

      const attempts = [raw];
      try {
        attempts.push(decodeURIComponent(raw));
        attempts.push(decodeURIComponent(decodeURIComponent(raw)));
      } catch (_) {}

      for (const val of attempts) {
        try {
          return JSON.parse(val);
        } catch (_) {}
      }
      return null;
    };

    const rawDietician = getCookie("dietician");
    const parsed = parseCookieJSON(rawDietician);

    if (parsed) {
      if (parsed.email) {
        setEmail(parsed.email);
      }
      if (parsed.dietician_id) {
        setDieticianId(parsed.dietician_id);
      }
    }
  }, []);

  useEffect(() => {
    if (!password && !confirmPassword) {
      setPasswordError("");
      return;
    }

    if (password && !isStrongPassword(password)) {
      setPasswordError(
        "Password must be at least 8 characters and include uppercase, lowercase, number and special character."
      );
      return;
    }

    if (confirmPassword && password !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setPasswordError("");
  }, [password, confirmPassword]);

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    
    setSuccessMessage("");
    
    if (passwordError) return;
    
    if (!dieticianId) {
      setPasswordError("Unable to identify your account. Please try logging in again.");
      return;
    }

    if (!isStrongPassword(password)) {
      setPasswordError("Please ensure all password requirements are met.");
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      
      const response = await updatePasswordService(dieticianId, password);
      
      if (response && response.message) {
        setSuccessMessage(response.message);
         toast.success("Password updated successfully!");
        clearCookies();
         router.push("/");
        
        
      } else {
        setPasswordError("Password update failed. Please try again.");
      }
      
    } catch (err) {
      console.error("Password update error:", err);
      setPasswordError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePaste = (e) => {
  e.preventDefault(); // Prevent the paste
  // You can also show a message to the user if you want
  // toast.error("Pasting is not allowed. Please type your password.");
};

  return (
    <>
      <div className="min-h-screen w-full flex items-center justify-center bg-[#F5F7FA]">
        <div className="bg-white w-[450px] p-6 rounded-[10px] border border-[#E1E6ED]">
          <h2 className="text-[34px] font-normal leading-normal tracking-[-2.04px] text-[#252525] text-center whitespace-nowrap">
            Set your password
          </h2>

          {successMessage && (
            <div className="mt-4 p-3 bg-green-100 text-green-700 rounded-lg text-sm">
              {successMessage}
              <p className="mt-1 text-xs">Redirecting to login page...</p>
            </div>
          )}

          <form onSubmit={handlePasswordReset} className="mt-[73px] space-y-4">
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder=" "
                value={password}
                autoComplete="new-password"
                onChange={(e) => setPassword(e.target.value)}
                 onPaste={handlePaste} 
                required
                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#E1E6ED] peer pr-10"
              />
              <label
                htmlFor="password"
                className="absolute left-3 top-3 text-[#A1A1A1] transition-all duration-200 pointer-events-none
                peer-placeholder-shown:top-3 peer-placeholder-shown:text-base
                peer-focus:top-[-10px] peer-focus:text-[12px] peer-focus:text-[#252525]
                peer-not-placeholder-shown:top-[-10px] peer-not-placeholder-shown:text-sm
                bg-white px-1"
              >
                Enter new password
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
            </div>

            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder=" "
                value={confirmPassword}
                autoComplete="new-password"
                onChange={(e) => setConfirmPassword(e.target.value)}
                 onPaste={handlePaste} 
                required
                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#E1E6ED] peer pr-10"
              />
              <label
                htmlFor="confirmPassword"
                className="absolute left-3 top-3 text-[#A1A1A1] transition-all duration-200 pointer-events-none
                peer-placeholder-shown:top-3 peer-placeholder-shown:text-base
                peer-focus:top-[-10px] peer-focus:text-[12px] peer-focus:text-[#252525]
                peer-not-placeholder-shown:top-[-10px] peer-not-placeholder-shown:text-sm
                bg-white px-1"
              >
                Confirm new password
              </label>

              <div
                className="absolute right-3 top-4 cursor-pointer"
                onClick={toggleConfirmPasswordVisibility}
              >
                <Image
                  src="/icons/hugeicons_view.svg"
                  alt={showConfirmPassword ? "Hide password" : "Show password"}
                  width={15}
                  height={15}
                  className={showConfirmPassword ? "opacity-50" : "opacity-100"}
                />
              </div>
            </div>

            {passwordError && (
              <p className="text-red-500 text-[12px] mt-1">{passwordError}</p>
            )}

            <div className="mt-3">
              <div className="mt-3 text-sm">
                <ul className="space-y-1">
                  <PasswordRule
                    label="Minimum number of characters is 8."
                    active={passwordRules.minLength(password)}
                  />
                  <PasswordRule
                    label="Should contain lowercase."
                    active={passwordRules.lowercase(password)}
                  />
                  <PasswordRule
                    label="Should contain uppercase."
                    active={passwordRules.uppercase(password)}
                  />
                  <PasswordRule
                    label="Should contain numbers."
                    active={passwordRules.numbers(password)}
                  />
                  <PasswordRule
                    label="Should contain special characters."
                    active={passwordRules.special(password)}
                  />
                </ul>
              </div>
            </div>

            <button
              type="submit"
              disabled={
                loading || !password || !confirmPassword || !!passwordError
              }
              className="w-full mt-5 cursor-pointer bg-[#308BF9] text-white py-[15px] px-[93px] rounded-lg font-semibold border border-transparent hover:bg-white hover:text-[#252525] hover:border-[#308BF9] transition disabled:opacity-60"
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}


















// "use client";

// import { useEffect, useState } from "react";
// import Image from "next/image";
// import Link from "next/link";

// function PasswordRule({ label, active }) {
//   return (
//     <li
//       className={`flex items-center gap-2 ${
//         active ? "text-green-600" : "text-[#6B7280]"
//       }`}
//     >
//       <span className="text-[12px]">{active ? "✔" : "✖"}</span>
//       <span className="text-[12px]">{label}</span>
//     </li>
//   );
// }

// export default function ChangePassword() {
//   const [email, setEmail] = useState("");

//   const [password, setPassword] = useState("");
//   const [confirmPassword, setConfirmPassword] = useState("");

//   const [showPassword, setShowPassword] = useState(false);
//   const [showConfirmPassword, setShowConfirmPassword] = useState(false);

//   const [loading, setLoading] = useState(false);
//   const [passwordError, setPasswordError] = useState("");

//   const togglePasswordVisibility = () => setShowPassword((p) => !p);
//   const toggleConfirmPasswordVisibility = () =>
//     setShowConfirmPassword((p) => !p);

//   // ✅ Rules + Strength (React controlled, no plugin)
//   const passwordRules = {
//     minLength: (pwd) => pwd.length >= 8,
//     lowercase: (pwd) => /[a-z]/.test(pwd),
//     uppercase: (pwd) => /[A-Z]/.test(pwd),
//     numbers: (pwd) => /\d/.test(pwd),
//     special: (pwd) => /[^A-Za-z\d]/.test(pwd),
//   };

//   const getStrengthScore = (pwd) => {
//     if (!pwd) return 0;
//     let score = 0;
//     Object.values(passwordRules).forEach((rule) => {
//       if (rule(pwd)) score++;
//     });
//     return score; // 0..5
//   };

//   const strengthLabels = [
//     "Empty",
//     "Weak",
//     "Medium",
//     "Strong",
//     "Very Strong",
//     "Super Strong",
//   ];

//   const strengthScore = getStrengthScore(password);
//   const strengthLabel = strengthLabels[strengthScore];

//   const isStrongPassword = (pwd) => {
//     // same rule you had (all conditions)
//     return (
//       passwordRules.minLength(pwd) &&
//       passwordRules.lowercase(pwd) &&
//       passwordRules.uppercase(pwd) &&
//       passwordRules.numbers(pwd) &&
//       passwordRules.special(pwd)
//     );
//   };

//   // ✅ READ EMAIL FROM "dietician" COOKIE (ROBUST)
//   useEffect(() => {
//     const getCookie = (name) => {
//       if (typeof document === "undefined") return "";
//       const match = document.cookie.match(
//         new RegExp("(^| )" + name + "=([^;]+)")
//       );
//       return match ? match[2] : "";
//     };

//     const parseCookieJSON = (raw) => {
//       if (!raw) return null;

//       const attempts = [raw];
//       try {
//         attempts.push(decodeURIComponent(raw));
//         attempts.push(decodeURIComponent(decodeURIComponent(raw)));
//       } catch (_) {}

//       for (const val of attempts) {
//         try {
//           return JSON.parse(val);
//         } catch (_) {}
//       }
//       return null;
//     };

//     const rawDietician = getCookie("dietician");
//     const parsed = parseCookieJSON(rawDietician);

//     if (parsed?.email) {
//       setEmail(parsed.email);
//     }
//   }, []);

//   // ✅ LIVE VALIDATION
//   useEffect(() => {
//     if (!password && !confirmPassword) {
//       setPasswordError("");
//       return;
//     }

//     if (password && !isStrongPassword(password)) {
//       setPasswordError(
//         "Password must be at least 8 characters and include uppercase, lowercase, number and special character."
//       );
//       return;
//     }

//     if (confirmPassword && password !== confirmPassword) {
//       setPasswordError("Passwords do not match.");
//       return;
//     }

//     setPasswordError("");
//   }, [password, confirmPassword]);

//   const handlePasswordReset = async (e) => {
//     e.preventDefault();
//     if (passwordError) return;

//     try {
//       setLoading(true);
//       // await resetPasswordService({ email, password });
//     } catch (err) {
//       setPasswordError("Something went wrong. Please try again.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <>
//       <div className="min-h-screen w-full flex items-center justify-center bg-[#F5F7FA]">
//         <div className="bg-white w-[450px] p-6 rounded-[10px] border border-[#E1E6ED]">
//           <h2 className="text-[34px] font-normal leading-normal tracking-[-2.04px] text-[#252525] text-center whitespace-nowrap">
//             Set your password
//           </h2>
 

//           <form onSubmit={handlePasswordReset} className="mt-[73px] space-y-4">
//             {/* PASSWORD */}
//             <div className="relative">
//               <input
//                 id="password"
//                 type={showPassword ? "text" : "password"}
//                 placeholder=" "
//                 value={password}
//                 autoComplete="new-password"
//                 onChange={(e) => setPassword(e.target.value)}
//                 required
//                 className="w-full p-3 border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#E1E6ED] peer pr-10"
//               />
//               <label
//                 htmlFor="password"
//                 className="absolute left-3 top-3 text-[#A1A1A1] transition-all duration-200 pointer-events-none
//                 peer-placeholder-shown:top-3 peer-placeholder-shown:text-base
//                 peer-focus:top-[-10px] peer-focus:text-[12px] peer-focus:text-[#252525]
//                 peer-not-placeholder-shown:top-[-10px] peer-not-placeholder-shown:text-sm
//                 bg-white px-1"
//               >
//                 Enter new password
//               </label>

//               <div
//                 className="absolute right-3 top-4 cursor-pointer"
//                 onClick={togglePasswordVisibility}
//               >
//                 <Image
//                   src="/icons/hugeicons_view.svg"
//                   alt={showPassword ? "Hide password" : "Show password"}
//                   width={15}
//                   height={15}
//                   className={showPassword ? "opacity-50" : "opacity-100"}
//                 />
//               </div>

             
//             </div>

//             {/* CONFIRM PASSWORD */}
//             <div className="relative">
//               <input
//                 id="confirmPassword"
//                 type={showConfirmPassword ? "text" : "password"}
//                 placeholder=" "
//                 value={confirmPassword}
//                 autoComplete="new-password"
//                 onChange={(e) => setConfirmPassword(e.target.value)}
//                 required
//                 className="w-full p-3 border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#E1E6ED] peer pr-10"
//               />
//               <label
//                 htmlFor="confirmPassword"
//                 className="absolute left-3 top-3 text-[#A1A1A1] transition-all duration-200 pointer-events-none
//                 peer-placeholder-shown:top-3 peer-placeholder-shown:text-base
//                 peer-focus:top-[-10px] peer-focus:text-[12px] peer-focus:text-[#252525]
//                 peer-not-placeholder-shown:top-[-10px] peer-not-placeholder-shown:text-sm
//                 bg-white px-1"
//               >
//                 Confirm new password
//               </label>

//               <div
//                 className="absolute right-3 top-4 cursor-pointer"
//                 onClick={toggleConfirmPasswordVisibility}
//               >
//                 <Image
//                   src="/icons/hugeicons_view.svg"
//                   alt={showConfirmPassword ? "Hide password" : "Show password"}
//                   width={15}
//                   height={15}
//                   className={showConfirmPassword ? "opacity-50" : "opacity-100"}
//                 />
//               </div>
//             </div>

//             {/* ERROR */}
//             {passwordError && (
//               <p className="text-red-500 text-[12px] mt-1">{passwordError}</p>
//             )}

//              {/* ✅ Password Strength Bar + Hints */}
//               <div className="mt-3">
//                 <div className="mt-3 text-sm">
//                   <ul className="space-y-1">
//                     <PasswordRule
//                       label="Minimum number of characters is 8."
//                       active={passwordRules.minLength(password)}
//                     />
//                     <PasswordRule
//                       label="Should contain lowercase."
//                       active={passwordRules.lowercase(password)}
//                     />
//                     <PasswordRule
//                       label="Should contain uppercase."
//                       active={passwordRules.uppercase(password)}
//                     />
//                     <PasswordRule
//                       label="Should contain numbers."
//                       active={passwordRules.numbers(password)}
//                     />
//                     <PasswordRule
//                       label="Should contain special characters."
//                       active={passwordRules.special(password)}
//                     />
//                   </ul>
//                 </div>
//               </div>

//             <button
//               type="submit"
//               disabled={
//                 loading || !password || !confirmPassword || !!passwordError
//               }
//               className="w-full mt-5 cursor-pointer bg-[#308BF9] text-white py-[15px] px-[93px] rounded-lg font-semibold border border-transparent hover:bg-white hover:text-[#252525] hover:border-[#308BF9] transition disabled:opacity-60"
//             >
//               {loading ? "Confirming..." : "Confirm"}
//             </button>
//           </form>

         
//         </div>
//       </div>
//     </>
//   );
// }
