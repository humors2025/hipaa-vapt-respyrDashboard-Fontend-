
// services/authService.js

import { apiFetcher } from "../config/fetcher";
import { API_ENDPOINTS } from "../config/apiConfig";
import { cookieManager } from "../lib/cookies";
import Cookies from "js-cookie";
import { getSuperAdminPartnerCode } from "../lib/superAdminContext";
import { refreshAccessToken } from "../lib/tokenRefresh";

function withSuperAdminPartnerCode(payload) {
  const partnerCode = getSuperAdminPartnerCode();
  if (partnerCode) {
    return { ...payload, dietitian_id: partnerCode };
  }
  return payload;
}



function decodeAccessTokenFromCookie() {
  try {
    const token = Cookies.get("access_token");

    if (!token) {
      return null;
    }

    const payload = token.split(".")[1];

    if (!payload) {
      return null;
    }

    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");

    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((char) => {
          return `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`;
        })
        .join("")
    );

    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

// Reads dietician_id straight from the decoded access_token cookie. The backend
// (requireProfileAccess) binds identity to the JWT — the requested dietitian_id
// must equal the token's dietician_id — so this is the only correct value to send.
// Note the token spells the claim `dietician_id` (with a "c"); we also fall back
// to the nested `dietician` object if the top-level claim is absent.
export function getDietitianIdFromAccessToken() {
  const decoded = decodeAccessTokenFromCookie();
  return decoded?.dietician_id ?? decoded?.dietician?.dietician_id ?? null;
}

// Reads profile_id from the current page URL query string (?profile_id=...).
function getProfileIdFromUrl() {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("profile_id");
}

function getActorUserIdFromAccessToken() {
  const decoded = decodeAccessTokenFromCookie();
  if (decoded?.user_id || decoded?.email) {
    return decoded.user_id ?? decoded.email;
  }

  const userCookie = Cookies.get("user");
  if (userCookie) {
    try {
      const user = JSON.parse(userCookie);
      return user?.user_id ?? user?.email ?? null;
    } catch {
      return null;
    }
  }

  return null;
}



export const loginService = async (email, password) => {
  return apiFetcher(API_ENDPOINTS.AUTH.LOGIN, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      identifier: email,
      password: password,
    }),
  });
};

// Exchange the stored refresh_token for a fresh access token. Normally you
// don't need to call this directly — apiFetcher refreshes automatically on a
// 401 and retries the request. Exposed for explicit/proactive refreshes (e.g.
// a timer that renews before expiry). Returns the new access token or null.
export const refreshTokenService = async () => {
  return refreshAccessToken();
};

export const sendOtpService = async (email) => {
  return apiFetcher(API_ENDPOINTS.AUTH.SEND_OTP, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: email,
    }),
  });
};

// Verifies the emailed OTP. On success the API returns a short-lived
// `reset_token` (hex, expires in `reset_token_expires_in` seconds) that must be
// passed back to update_diatitian_password — the OTP itself is only checked
// server-side and never returned to the client.
export const verifyOtpService = async (email, otp) => {
  return apiFetcher(API_ENDPOINTS.AUTH.VERIFY_OTP, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: email,
      otp: otp,
    }),
  });
};


export const updatePasswordService = async (dieticianId, password) => {
  return apiFetcher(API_ENDPOINTS.AUTH.UPDATEPASSWORDSERVICE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      dietician_id: dieticianId,
      password: password,
    }),
  });
};



// Final step: set the new password. `resetToken` is the token returned by
// verifyOtpService and proves the OTP was verified for this email.
export const resetPasswordService = async (email, resetToken, password, confirmPassword) => {
  return apiFetcher(API_ENDPOINTS.AUTH.RESET_PASSWORD, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: email,
      reset_token: resetToken,
      password: password,
      confirm_password: confirmPassword,
    }),
  });
};


export const updateDietPlanStatusService = async (dieticianId) => {
  return apiFetcher(API_ENDPOINTS.AUTH.DIETPLANSTATUS, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      dietitian_id: dieticianId,
    }),
  });
};


export const fetchClientsWithDietPlan = async (dieticianId) => {
  return apiFetcher(API_ENDPOINTS.CLIENT.CLIENTTABLE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      dietician_id: dieticianId,
    }),
  });
};


export const fetchTrainerAdminClientsListDirService = async ({
  page = 1,
  limit = 10,
  search = "",
} = {}) => {
  const accessToken = Cookies.get("access_token");

  if (!accessToken) {
    throw new Error("Access token missing. Please login again.");
  }

  const decoded = decodeAccessTokenFromCookie();

  const actorUserId = decoded?.user_id ?? decoded?.email;
  const trainerId = decoded?.partner_code ?? decoded?.dietician_id ?? decoded?.sub;

  if (!actorUserId || !trainerId) {
    throw new Error("Session expired. Please login again.");
  }

  const res = await apiFetcher(API_ENDPOINTS.CLIENT.TRAINERADMINCLIENTSLISTDIR, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      actor_user_id: actorUserId,
      trainer_id: trainerId,
      page,
      limit,
      search,
    }),
  });

  if (res && res.status === false) {
    throw new Error(res.message || "Failed to fetch clients");
  }

  return res;
};





export const fetchScoreTrend = async (dieticianId, profileId, mode) => {
  return apiFetcher(API_ENDPOINTS.PROFILESCOREANALYSIS.GRAPH, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      dietitian_id: dieticianId,
      profile_id: profileId,
      // dietitian_id: "RespyrD02",
      // profile_id: "profile3",
      //mode: mode.toLowerCase(), 
    }),
  });
};  



export const fetchScoresInsight = async (dieticianId, profileId, date) => {
  try {
    const response = await apiFetcher(API_ENDPOINTS.PROFILESCOREANALYSIS.SCORESINSIGHT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dietician_id: dieticianId,
        profile_id: profileId,
        date: date,
      }),
    });

    return response;
  } catch (error) {
    // If it's the "no data" error, return a special object instead of throwing
    if (error.message === "No test_data found for given inputs") {
      return { noData: true, message: error.message };
    }
    // Re-throw other errors
    throw error;
  }
};




export const submitPlanSummaryService = async (planData) => {
  return apiFetcher(API_ENDPOINTS.PLAN.PLANSUMMARYFORM, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(planData),
  });
};



export const fetchClientProfileData = async (dieticianId, profileId) => {
  return apiFetcher(API_ENDPOINTS.CLIENTPROFILE.CLIENTPROFILEDATA, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      dietician_id: dieticianId,
      profile_id: profileId,
    }),
  });
};




// export const fetchWeeklyAnalysisComplete = async (requestData) => {
//   return apiFetcher(API_ENDPOINTS.MEALANALYSIS.WEEKLYANALYSISCOMPLETE, {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json",
//     },
//     body: JSON.stringify(requestData),
//   });
// };

export const checkWeeklyAnalysisService = async (dieticianId, profileId, startDate, endDate) => {
  return apiFetcher(API_ENDPOINTS.MEALANALYSIS.CHECKWEEKLYANALYSIS, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      dietician_id: dieticianId,
      profile_id: profileId,
      start_date: startDate,
      end_date: endDate,
    }),
  });
};


export const saveWeeklyFoodJson = async (dietitian_id, profile_id, start_date, end_date, food_json) => {
  return apiFetcher(API_ENDPOINTS.MEALANALYSIS.ADDFOOD, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      dietitian_id: dietitian_id,
      profile_id: profile_id,
      start_date: start_date,
      end_date: end_date,
      food_json: food_json,
    }),
  });
};


// services/authService.js

export const fetchSavedWeeklyFoodJson = async (profileId, startDate, endDate, dieticianId = null) => {
  // Build query parameters
  const params = new URLSearchParams();
  params.append('profile_id', profileId);
  params.append('start_date', startDate);
  params.append('end_date', endDate);
  
  // Add dietitian_id if provided
  if (dieticianId) {
    params.append('dietician_id', dieticianId);
  }
  
  // Make GET request with query parameters
  const url = `${API_ENDPOINTS.MEALANALYSIS.GETFOOD}?${params.toString()}`;
  
  try {
    const response = await apiFetcher(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    
    return response;
  } catch (error) {
    // Check if it's the "no data found" error
    if (error.message?.includes("No data found") || 
        error.data?.message?.includes("No data found") ||
        error.message === "Weekly food data not found") {
      
      // Return a special response object instead of throwing
      return { 
        success: false, 
        noData: true, 
        message: "No data found for this week" 
      };
    }
    
    // Re-throw other errors
    throw error;
  }
};

  
export const fetchWeeklyAnalysisComplete1 = async (requestData) => {
  return apiFetcher(API_ENDPOINTS.MEALANALYSIS.WEEKLYANALYSISCOMPLETE1, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestData),
      timeoutMs: 180000,
  });
};



export const fetchDashboardTableCards = async (dieticianId) => {
  return apiFetcher(API_ENDPOINTS.DASHBOARD.TABLECARDS, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      dietician_id: dieticianId,
    }),
  });
};



export const fetchTestAnalytics = async (dieticianId, date = "") => {
  return apiFetcher(API_ENDPOINTS.DASHBOARD.TESTANALYTICS, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      dietitian_id: dieticianId,
      date: date,
    }),
  });
};



export const fetchTestRemaining = async (dieticianId) => {
  return apiFetcher(API_ENDPOINTS.TESTINFO.TESTREMAINING, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      dietitian_id: dieticianId,
    }),
  });
};



export const fetchClientLog = async (dieticianId, clientId) => {
  return apiFetcher(API_ENDPOINTS.PLANHISTORY.CLIENTLOG, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      dietitian_id: dieticianId,
      client_id: clientId,
    }),
  });
};



export const updateDietPlanJsonService = async (login_id, profile_id, diet_plan_id, diet_json) => {
  return apiFetcher(API_ENDPOINTS.PLAN.DIETPLAN, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      login_id: login_id,
      profile_id: profile_id,
      diet_plan_id: diet_plan_id,
      diet_json: JSON.stringify(diet_json),
    }),
  });
};

export const updateDietPlanFoodService = async (payload) => {
  return apiFetcher(API_ENDPOINTS.PLAN.UPDATEDIETFOOD, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
};



export const fetchDietPlanJsonService = async (login_id, profile_id, diet_plan_id) => {
  return apiFetcher(API_ENDPOINTS.PLAN.DIETPLANJSON, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      login_id: login_id,
      profile_id: profile_id,
      diet_plan_id: diet_plan_id,
    }),
  });
};




export const deleteDietPlanService = async (dietPlanId, clientId, dietitianId) => {
  return apiFetcher(API_ENDPOINTS.PLAN.DELETEDIETPLAN, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      diet_plan_id: String(dietPlanId),
      client_id: String(clientId),
      dietitian_id: String(dietitianId),
    }),
  });
};



// export const fetchClientsDashboard = async (
//   dieticianId,
//   type = "all",
//   page = 1,
//   date,
//   { masking = false } = {}
// ) => {
//   const endpoint = masking
//     ? API_ENDPOINTS.CLIENT.CLIENTS_DASHBOARD_MASKED
//     : API_ENDPOINTS.CLIENT.CLIENTS_DASHBOARD;

//   const body = {
//     dietician_id: dieticianId,
//     type: type,
//     page: page,
//     date: date,
//   };

//   if (masking) {
//     const decoded = decodeAccessTokenFromCookie();
//     const actorUserId = decoded?.user_id;
//     if (actorUserId) {
//       body.actor_user_id = actorUserId;
//     }
//   }

//   const accessToken = Cookies.get("access_token");

//   return apiFetcher(endpoint, {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json",
//       Authorization: `Bearer ${accessToken}`,
//     },
//     body: JSON.stringify(body),
//   });
// };




export const fetchClientsDashboard = async (
  dieticianId,
  type = "all",
  page = 1,
  date,
  { masking = false } = {}
) => {
  const endpoint = masking
    ? API_ENDPOINTS.CLIENT.CLIENTS_DASHBOARD_MASKED
    : API_ENDPOINTS.CLIENT.CLIENTS_DASHBOARD;

  const body = {
    dietician_id: dieticianId,
    type: type,
    page: page,
    date: date,
  };

  // actor_user_id is the user_id decoded from the access_token cookie.
  // Required by the API on both the normal and masked routes.
  const decoded = decodeAccessTokenFromCookie();
  const actorUserId = decoded?.user_id;
  if (actorUserId) {
    body.actor_user_id = actorUserId;
  }

  return apiFetcher(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
};


export const fetchCalendarData = async (dieticianId) => {
  const accessToken = Cookies.get("access_token");

  if (!accessToken) {
    throw new Error("Access token missing. Please login again.");
  }

  const partnerCode = getSuperAdminPartnerCode();
  const effectiveDietitianId = partnerCode || dieticianId;

  return apiFetcher(API_ENDPOINTS.CALENDER.CALENDERTABLE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      dietician_id: effectiveDietitianId,
    }),
  });
};



export const fetchClientProfileDetails = async (profileId, range = "weekly", dietitianId) => {
  if (!profileId) {
    throw new Error("Profile ID is required");
  }

  if (!dietitianId) {
    throw new Error("Dietitian ID is required");
  }

  const partnerCode = getSuperAdminPartnerCode();
  const effectiveDietitianId = partnerCode || dietitianId;
  const url = `${API_ENDPOINTS.CLIENTPROFILE.CLIENTPROFILEDETAILS}?profile_id=${encodeURIComponent(
    profileId
  )}&range=${encodeURIComponent(range)}&dietitian_id=${encodeURIComponent(effectiveDietitianId)}`;

  return apiFetcher(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });
};



export const fetchClientIndividualProfile = async (profileId, date, dietitianId, { masking = false } = {}) => {
  const endpoint = masking
    ? API_ENDPOINTS.CLIENTPROFILE.CLIENTINDIVIDUALPROFILEMASKING
    : API_ENDPOINTS.CLIENTPROFILE.CLIENTINDIVIDUALPROFILE;

  const basePayload = {
    profile_id: profileId,
    date: date,
    dietitian_id: dietitianId,
  };

  if (masking) {
    const decoded = decodeAccessTokenFromCookie();
    const actorUserId = decoded?.user_id;
    if (actorUserId) {
      basePayload.actor_user_id = actorUserId;
    }
  }

  return apiFetcher(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(withSuperAdminPartnerCode(basePayload)),
  });
};



// Add to authService.js
// Payload is sourced from the session: profile_id from the URL, dietitian_id from
// the access_token cookie. The backend binds identity to the JWT and requires the
// requested dietitian_id to equal the token's dietician_id, so we always send the
// token value and do NOT apply the partner_code override here (that would send the
// owning trainer's id and get rejected with a 403).
export const fetchClientProfileDatesList = async (profileId, dietitianId) => {
  const resolvedProfileId = profileId ?? getProfileIdFromUrl();
  const resolvedDietitianId = getDietitianIdFromAccessToken();

  return apiFetcher(API_ENDPOINTS.CLIENTPROFILE.CLIENTPROFILEDATESLIST, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      profile_id: resolvedProfileId,
      dietitian_id: resolvedDietitianId,
    }),
  });
};



export const searchClientsService = async (dieticianId, searchTerm) => {
  return apiFetcher(API_ENDPOINTS.SEARCH.SEARCHCLIENT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      dietician_id: dieticianId,
      search: searchTerm,
    }),
  });
};



export const fetchDietAnalysisPlan = async (
  profileId,
  weekStartDate,
  weekEndDate,
  dietitianId
) => {
  return apiFetcher(API_ENDPOINTS.DIETANALYSIS.DIETANALYSISPLAN, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(withSuperAdminPartnerCode({
      profile_id: profileId,
      week_start_date: weekStartDate,
      week_end_date: weekEndDate,
       dietitian_id: dietitianId,
    })),
  });
};


export const fetchClientWeeklyDates = async (profileId, dietitianId) => {
  try {
    const accessToken = Cookies.get("access_token");
    // profile_id from URL, dietitian_id from the access_token (JWT-bound identity
    // the backend requires). No partner_code override — see fetchClientProfileDatesList.
    const resolvedProfileId = profileId ?? getProfileIdFromUrl();
    const resolvedDietitianId = getDietitianIdFromAccessToken();

    const response = await apiFetcher(API_ENDPOINTS.CLIENTPROFILE.CLIENTWEEKLYDATES, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        profile_id: resolvedProfileId,
        dietitian_id: resolvedDietitianId,
      }),
    });
    
    return response;
  } catch (error) {
    // Check if it's the "no weekly data found" error
    if (error.message?.includes("No weekly data found") || 
        error.data?.message?.includes("No weekly data found")) {
      // Return a special response object instead of throwing
      return { 
        status: false, 
        message: error.message || "No weekly data found for last 3 months",
        profile_id: profileId
      };
    }
    // Re-throw other errors
    throw error;
  }
};



// export const fetchMacroSummaryByDate = async (profileId, date, dietitianId) => {
//   return apiFetcher(API_ENDPOINTS.MACROSANALYSIS.GETMACROSUMMARY, {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json",
//     },
//     body: JSON.stringify(withSuperAdminPartnerCode({
//       profile_id: profileId,
//       dietitian_id: dietitianId,
//       date: date,
//     })),
//   });
// };




export const fetchMacroSummaryByDate = async (profileId, date) => {
  return apiFetcher(API_ENDPOINTS.MACROSANALYSIS.GETMACROSUMMARY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      profile_id: profileId,
      dietitian_id: getDietitianIdFromAccessToken(),
      date,
    }),
  });
};



export const fetchHabitsMonitoringData = async (profileId, dietitianId) => {
  // Current date as YYYY-MM-DD (local time).
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  return apiFetcher(API_ENDPOINTS.HABITMONITORING.GETHABITSDATA, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(withSuperAdminPartnerCode({
      action: "weekly_tracking",
      profile_id: profileId,
      dietitian_id: dietitianId,
      date,
    })),
  });
};


// Weight logs for the Weight Tracking tab.
//   profile_id      – the client being viewed (from the ?profile_id= URL param)
//   dietician_id    – the JWT-bound dietician identity (access_token claim)
//   actor_user_id   – the acting user's id (access_token `user_id` claim)
// Note the API spells the claim `dietician_id` (with a "c"); we match that here.
// Returns the raw API response — the component reads `res.data` as an array of
// weight_log rows (weight_kg, log_date, log_time, created_at).
export const fetchWeightTracking = async (profileId, dieticianId) => {
  const resolvedProfileId = profileId ?? getProfileIdFromUrl();
  const resolvedDieticianId = dieticianId ?? getDietitianIdFromAccessToken();
  const resolvedActorUserId = getActorUserIdFromAccessToken() ?? "";

  return apiFetcher(API_ENDPOINTS.WEIGHTTRACKING.GETWEIGHTLOGS, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      profile_id: resolvedProfileId,
      dietician_id: resolvedDieticianId,
      actor_user_id: resolvedActorUserId,
    }),
  });
};


export const updatePerformanceLevel = async (dietitianId, profileId, levelType) => {
  return apiFetcher(API_ENDPOINTS.LEVELUPDATE.LEVEL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      dietitian_id: dietitianId,
      profile_id: profileId,
      level_type: levelType,
    }),
  });
};


// On the masked route the API redacts client identity: name/email arrive
// partially starred, and dob/age/region/location come back as the literal
// string "hidden". Callers must render those defensively.
export const getClientProfileDetails = async (
  profileId,
  dietitianId,
  { masking = false } = {}
) => {
  const endpoint = masking
    ? API_ENDPOINTS.CLIENTPROFILE.GETCLIENTPROFILEDETAILSMASKED
    : API_ENDPOINTS.CLIENTPROFILE.GETCLIENTPROFILEDETAILS;

  const basePayload = {
    profile_id: profileId ?? getProfileIdFromUrl(),
    dietitian_id: dietitianId ?? getDietitianIdFromAccessToken(),
  };

  if (masking) {
    const decoded = decodeAccessTokenFromCookie();
    const actorUserId = decoded?.user_id;
    if (actorUserId) {
      basePayload.actor_user_id = actorUserId;
    }
  }

  return apiFetcher(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(withSuperAdminPartnerCode(basePayload)),
  });
};



export const fetchTrainerDirection = async (profileId, dietitianId, date) => {
  return apiFetcher(API_ENDPOINTS.TRAINER.TRAINERDIRECTION, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(withSuperAdminPartnerCode({
      profile_id: profileId,
      dietitian_id: dietitianId,
      date: date,
    })),
  });
};



export const approveDietPlanService = async (profileId, dieticianId, id, status) => {
  return apiFetcher(API_ENDPOINTS.DIETANALYSIS.APPROVALPLAN, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      profile_id: profileId,
      dietician_id: dieticianId,
      id: id,
      status: status,
    }),
  });
};



export const inviteTrainerAdminService = async ({
  firstName,
  lastName,
  email,
  phone,
}) => {
  const actorUserId = getActorUserIdFromAccessToken();

  if (!actorUserId) {
    throw new Error("Session expired. Please login again.");
  }

  return apiFetcher(API_ENDPOINTS.ADMINPANEL.INVITETRAINERADMIN, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Cookies.get("access_token")}`,
    },
    body: JSON.stringify({
      actor_user_id: actorUserId,
      first_name: firstName,
      last_name: lastName,
      email: email,
      phone: phone,
    }),
  });
};




export const fetchTrainerAdminListService = async () => {
  const accessToken = Cookies.get("access_token");

  if (!accessToken) {
    throw new Error("Access token missing. Please login again.");
  }

  const actorUserId = getActorUserIdFromAccessToken();

  if (!actorUserId) {
    throw new Error("Session expired. Please login again.");
  }

  return apiFetcher(API_ENDPOINTS.ADMINPANEL.TRAINERADMINLIST, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ actor_user_id: actorUserId }),
  });
};


export const fetchAllTrainersForSuperAdminService = async ({
  page = 1,
  limit = 10,
  search = "",
  trainerAdminUserId = "",
  status = "all",
} = {}) => {
  const accessToken = Cookies.get("access_token");

  if (!accessToken) {
    throw new Error("Access token missing. Please login again.");
  }

  const actorUserId = getActorUserIdFromAccessToken();

  if (!actorUserId) {
    throw new Error("Session expired. Please login again.");
  }

  return apiFetcher(API_ENDPOINTS.ADMINPANEL.LISTALLTRAINERSFORSUPERADMIN, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      actor_user_id: actorUserId,
      page,
      limit,
      search,
      trainer_admin_user_id: trainerAdminUserId,
      status,
    }),
  });
};


// Super admin: all clients across the entire network
// (super-admin-all-clients-overview.php).
// actor_user_id  -> user_id decoded from the access token
// dietitian_id   -> partner_code decoded from the access token (used as a
//                   filter; pass a specific code to scope to one dietitian,
//                   or "" to list every client in the network)
export const fetchSuperAdminAllClientsOverviewService = async ({
  page = 1,
  limit = 10,
  search = "",
  date = "",
  type = "all",
  dietitianId = "",
} = {}) => {
  const accessToken = Cookies.get("access_token");

  if (!accessToken) {
    throw new Error("Access token missing. Please login again.");
  }

  const decoded = decodeAccessTokenFromCookie();
  const actorUserId = decoded?.user_id ?? decoded?.email ?? getActorUserIdFromAccessToken();

  if (!actorUserId) {
    throw new Error("Session expired. Please login again.");
  }

  return apiFetcher(API_ENDPOINTS.ADMINPANEL.SUPERADMINALLCLIENTSOVERVIEW, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      actor_user_id: actorUserId,
      page,
      limit,
      search,
      date,
      type,
      // Empty string lists every client in the network; pass a specific
      // partner_code (dietitian_id) to scope the result to one dietitian.
      dietitian_id: dietitianId || "",
    }),
  });
};


export const fetchTrainerClientsOverviewForSuperAdminService = async ({
  trainerId,
  page = 1,
  limit = 10,
  search = "",
} = {}) => {
  const accessToken = Cookies.get("access_token");

  if (!accessToken) {
    throw new Error("Access token missing. Please login again.");
  }

  const actorUserId = getActorUserIdFromAccessToken();

  if (!actorUserId) {
    throw new Error("Session expired. Please login again.");
  }

  if (!trainerId) {
    throw new Error("Trainer ID is required.");
  }

  return apiFetcher(API_ENDPOINTS.ADMINPANEL.TRAINERCLIENTSOVERVIEWFORSUPERADMIN, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      actor_user_id: actorUserId,
      trainer_id: trainerId,
      page,
      limit,
      search,
    }),
  });
};


// Lists the admin groups the logged-in user can manage (manage_admin_groups.php).
// actor_user_id is the user_id decoded from the access_token cookie; action is
// always "list_groups". Called right after a successful login.
export const fetchAdminGroupsService = async () => {
  const accessToken = Cookies.get("access_token");

  if (!accessToken) {
    throw new Error("Access token missing. Please login again.");
  }

  const actorUserId = getActorUserIdFromAccessToken();

  if (!actorUserId) {
    throw new Error("Session expired. Please login again.");
  }

  return apiFetcher(API_ENDPOINTS.ADMINPANEL.MANAGEADMINGROUPS, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      actor_user_id: actorUserId,
      action: "list_groups",
    }),
  });
};


// Paginated details for a single admin group (get_group_details.php).
// actor_user_id is the user_id decoded from the access_token cookie; group_name
// identifies which group to expand (sourced from the MANAGEADMINGROUPS response).
// The clients and trainers lists paginate INDEPENDENTLY: page/limit/clients_search
// drive clients[] + clients_pagination, trainer_page/trainer_limit/trainer_search
// drive trainers[] + trainers_pagination.
export const fetchGroupDetailsService = async ({
  groupName,
  page = 1,
  limit = 10,
  search = "",
  trainerPage = 1,
  trainerLimit = 100,
  trainerSearch = "",
  overviewDate = "",
  overviewMember = "",
} = {}) => {
  const accessToken = Cookies.get("access_token");

  if (!accessToken) {
    throw new Error("Access token missing. Please login again.");
  }

  const actorUserId = getActorUserIdFromAccessToken();

  if (!actorUserId) {
    throw new Error("Session expired. Please login again.");
  }

  if (!groupName) {
    throw new Error("Group name is required.");
  }

  const body = {
    actor_user_id: actorUserId,
    group_name: groupName,
    // Clients list window. `search` is kept alongside `clients_search` so the call
    // works against both the old (single `search`) and current API contracts.
    page,
    limit,
    search,
    clients_search: search,
    // Trainers list window — independent of the clients one.
    trainer_page: trainerPage,
    trainer_limit: trainerLimit,
    trainer_search: trainerSearch,
  };
  // Scopes period_overview to a single day (YYYY-MM-DD); omitted → backend default (today).
  if (overviewDate) body.overview_date = overviewDate;
  // Scopes period_overview to one admin's sub-network (their partner_code); omitted → whole group.
  if (overviewMember) body.overview_member = overviewMember;

  return apiFetcher(API_ENDPOINTS.ADMINPANEL.GETGROUPDETAILS, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
};

// Lightweight GETGROUPDETAILS call used only to read a single day's period_overview.
// The backend scopes period_overview to overview_date (one day), so multi-day (W/M)
// totals are built by summing one of these per day. overviewMember scopes it to a
// single admin's sub-network (omit → whole group). limit:1 keeps the payload small
// — we ignore the clients list and just return the period_overview block.


// Trainers/clients onboarded inside a date window for one admin group
// (get_group_onboarding.php). group_name comes from the MANAGEADMINGROUPS
// response; actor_user_id is the user_id decoded from the access_token cookie.
// type: "all" | "trainers" | "clients" — which list the backend paginates.
// member: a single admin's partner_code to scope to their sub-network ("" = whole group).
export const fetchGroupOnboardingService = async ({
  groupName,
  dateFrom,
  dateTo,
  type = "all",
  member = "",
  page = 1,
  limit = 10,
  search = "",
} = {}) => {
  const accessToken = Cookies.get("access_token");

  if (!accessToken) {
    throw new Error("Access token missing. Please login again.");
  }

  const actorUserId = getActorUserIdFromAccessToken();

  if (!actorUserId) {
    throw new Error("Session expired. Please login again.");
  }

  if (!groupName) {
    throw new Error("Group name is required.");
  }

  return apiFetcher(API_ENDPOINTS.ADMINPANEL.GETGROUPONBOARDING, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      group_name: groupName,
      date_from: dateFrom,
      date_to: dateTo,
      type,
      member,
      page,
      limit,
      search,
      actor_user_id: actorUserId,
    }),
  });
};


// Who actually took readings inside a date window for one admin group
// (get_group_period_readers.php) — the drill-down behind the analytics
// "Reading Split" (Trainers / Clients). group_name comes from the
// MANAGEADMINGROUPS response; actor_user_id is the user_id decoded from the
// access_token cookie. overview_from/overview_to bound the window (same day for
// a single-day period); overview_member scopes it to one admin's sub-network
// ("" = whole group). type: "all" | "trainers" | "clients" — which reader list
// the backend paginates.
export const fetchGroupPeriodReadersService = async ({
  groupName,
  overviewFrom,
  overviewTo,
  overviewMember = "",
  type = "all",
  page = 1,
  limit = 50,
  search = "",
} = {}) => {
  const accessToken = Cookies.get("access_token");

  if (!accessToken) {
    throw new Error("Access token missing. Please login again.");
  }

  const actorUserId = getActorUserIdFromAccessToken();

  if (!actorUserId) {
    throw new Error("Session expired. Please login again.");
  }

  if (!groupName) {
    throw new Error("Group name is required.");
  }

  return apiFetcher(API_ENDPOINTS.ADMINPANEL.GETGROUPPERIODREADERS, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      actor_user_id: actorUserId,
      group_name: groupName,
      overview_from: overviewFrom,
      overview_to: overviewTo || overviewFrom,
      overview_member: overviewMember,
      type,
      page,
      limit,
      search,
    }),
  });
};


export const fetchGroupPeriodOverviewService = async ({ groupName, overviewDate, overviewMember } = {}) => {
  if (!groupName) throw new Error("Group name is required.");
  // limit/trainer_limit of 1 keeps the payload small — only period_overview is read.
  const res = await fetchGroupDetailsService({ groupName, page: 1, limit: 1, search: "", trainerPage: 1, trainerLimit: 1, trainerSearch: "", overviewDate, overviewMember });
  return res?.period_overview || null;
};


export const fetchSuperAdminOverviewService = async () => {
  const accessToken = Cookies.get("access_token");

  if (!accessToken) {
    throw new Error("Access token missing. Please login again.");
  }

  const actorUserId = getActorUserIdFromAccessToken();

  if (!actorUserId) {
    throw new Error("Session expired. Please login again.");
  }

  return apiFetcher(API_ENDPOINTS.ADMINPANEL.SUPERADMINOVERVIEW, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ actor_user_id: actorUserId }),
  });
};



// Internal Next.js route (/api/food/search). Like fetchDownstreamUsersService,
// this uses a raw fetch instead of apiFetcher: the route lives on the app's own
// origin (it must NOT be prefixed with API_BASE_URL), and it needs to forward the
// caller's AbortController signal for debounced/cancelable searches.
export const searchFoodService = async (query, { limit = 6, dietType = "", country = "", signal } = {}) => {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  if (dietType) params.set("diet_type", dietType);
  if (country) params.set("country", country);

  const res = await fetch(`${API_ENDPOINTS.FOOD.FOODSEARCH}?${params.toString()}`, {
    method: "GET",
    signal,
  });

  if (!res.ok) {
    throw new Error("Food search failed");
  }

  return res.json();
};



export const fetchDownstreamUsersService = async (actorUserId) => {
  if (!actorUserId) {
    throw new Error("Actor user ID missing.");
  }

  const accessToken = Cookies.get("access_token");

  const res = await fetch(API_ENDPOINTS.ADMINPANEL.LISTUSERSINTERNAL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ actor_user_id: actorUserId }),
  });

  if (!res.ok) {
    throw new Error("Failed to fetch downstream users");
  }

  return res.json();
};

export const fetchTrainerAdminOverviewService = async (
  actorUserId,
  email,
  { page = 1, limit = 20 } = {}
) => {
  if (!actorUserId) {
    throw new Error("Actor user ID missing.");
  }

  const accessToken = Cookies.get("access_token");

  return apiFetcher(API_ENDPOINTS.ADMINPANEL.TRAINERLISTINVITES, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({
      actor_user_id: actorUserId,
      ...(email ? { email } : {}),
      page,
      limit,
    }),
  });
};


export const inviteTrainerClientService = async ({
  firstName,
  lastName,
  email,
  phone,
}) => {
  const actorUserId = getActorUserIdFromAccessToken();

  if (!actorUserId) {
    throw new Error("Session expired. Please login again.");
  }

  return apiFetcher(API_ENDPOINTS.ADMINPANEL.INVITETRAINER, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Cookies.get("access_token")}`,
    },
    body: JSON.stringify({
      actor_user_id: actorUserId,
      first_name: firstName,
      last_name: lastName,
      email: email,
      phone: phone,
    }),
  });
};


// Super admin invites a trainer directly (super-admin-invite-trainer.php).
// Same payload shape as the trainer-admin invite; actor_user_id is taken from
// the super admin's access token (user_id).
export const superAdminInviteTrainerService = async ({
  firstName,
  lastName,
  email,
  phone,
}) => {
  const accessToken = Cookies.get("access_token");

  if (!accessToken) {
    throw new Error("Access token missing. Please login again.");
  }

  const actorUserId = getActorUserIdFromAccessToken();

  if (!actorUserId) {
    throw new Error("Session expired. Please login again.");
  }

  return apiFetcher(API_ENDPOINTS.ADMINPANEL.SUPERADMININVITETRAINER, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      actor_user_id: actorUserId,
      first_name: firstName,
      last_name: lastName,
      email: email,
      phone: phone,
    }),
  });
};


export const resendTrainerAdminInviteService = async ({ invitationId }) => {
  const actorUserId = getActorUserIdFromAccessToken();

  if (!actorUserId) {
    throw new Error("Session expired. Please login again.");
  }

  return apiFetcher(API_ENDPOINTS.ADMINPANEL.RESENDUSERINVITE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Cookies.get("access_token")}`,
    },
    body: JSON.stringify({
      actor_user_id: actorUserId,
      invite_id: invitationId,
    }),
  });
};

export const resendUserInviteService = async ({ inviteId }) => {
  const actorUserId = getActorUserIdFromAccessToken();

  if (!actorUserId) {
    throw new Error("Session expired. Please login again.");
  }

  return apiFetcher(API_ENDPOINTS.ADMINPANEL.RESENDUSERINVITE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Cookies.get("access_token")}`,
    },
    body: JSON.stringify({
      actor_user_id: actorUserId,
      invite_id: inviteId,
    }),
  });
};

// Super admin resends a trainer invite (super-admin-resend-trainers.php).
// Same payload as the trainer-admin resend; actor_user_id comes from the
// super admin's access token (user_id).
export const superAdminResendTrainerInviteService = async ({ inviteId }) => {
  const actorUserId = getActorUserIdFromAccessToken();

  if (!actorUserId) {
    throw new Error("Session expired. Please login again.");
  }

  return apiFetcher(API_ENDPOINTS.ADMINPANEL.SUPERADMINRESENDTRAINER, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Cookies.get("access_token")}`,
    },
    body: JSON.stringify({
      actor_user_id: actorUserId,
      invite_id: inviteId,
    }),
  });
};

export const revokeTrainerAdminInviteService = async ({ invitationId, reason }) => {
  const actorUserId = getActorUserIdFromAccessToken();

  if (!actorUserId) {
    throw new Error("Session expired. Please login again.");
  }

  return apiFetcher(API_ENDPOINTS.ADMINPANEL.REVOKEUSERINVITE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Cookies.get("access_token")}`,
    },
    body: JSON.stringify({
      actor_user_id: actorUserId,
      invite_id: invitationId,
      reason: reason ?? "",
    }),
  });
};

export const resendTrainerClientInviteService = async ({ inviteId, trainerID, clientName, clientMobile, clientEmail, plan }) => {
  return apiFetcher(API_ENDPOINTS.ADMINPANEL.INVITETRAINER, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Cookies.get("access_token")}`,
    },
    body: JSON.stringify({
      trainer_id: trainerID,
      client_name: clientName,
      client_mobile: clientMobile,
      client_email: clientEmail,
      plan: plan,
      resend: true,
    }),
  });
};

export const revokeTrainerClientInviteService = async ({ inviteId, reason }) => {
  const actorUserId = getActorUserIdFromAccessToken();

  if (!actorUserId) {
    throw new Error("Session expired. Please login again.");
  }

  return apiFetcher(API_ENDPOINTS.ADMINPANEL.REVOKEUSERINVITE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Cookies.get("access_token")}`,
    },
    body: JSON.stringify({
      actor_user_id: actorUserId,
      invite_id: inviteId,
      reason: reason ?? "",
    }),
  });
};

// Super admin revokes a trainer invite (super-admin-revoke-trainers.php).
// Same payload as the trainer-admin revoke; actor_user_id comes from the
// super admin's access token (user_id).
export const superAdminRevokeTrainerInviteService = async ({ inviteId, reason }) => {
  const actorUserId = getActorUserIdFromAccessToken();

  if (!actorUserId) {
    throw new Error("Session expired. Please login again.");
  }

  return apiFetcher(API_ENDPOINTS.ADMINPANEL.SUPERADMINREVOKETRAINER, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Cookies.get("access_token")}`,
    },
    body: JSON.stringify({
      actor_user_id: actorUserId,
      invite_id: inviteId,
      reason: reason ?? "",
    }),
  });
};

export const validateInviteTokenService = async (token) => {
  return apiFetcher(`${API_ENDPOINTS.ADMINPANEL.VALIDATEINVITETOKEN}?token=${encodeURIComponent(token)}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });
};

export const previewInviteService = async (token) => {
  return apiFetcher(API_ENDPOINTS.ADMINPANEL.INVITEPREVIEW, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token }),
  });
};

export const acceptInviteService = async (payload) => {
  return apiFetcher(API_ENDPOINTS.ADMINPANEL.ACCEPTINVITE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
};


export const createAgreementUploadUrlService = async (payload) => {
  return apiFetcher(API_ENDPOINTS.ADMINPANEL.AGREEMENTUPLOADURL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
};

export const uploadAgreementPdfToS3 = async (uploadUrl, file) => {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "application/pdf",
    },
    body: file,
  });

  if (!res.ok) {
    throw new Error("Agreement PDF upload failed");
  }

  return true;
};


export const fetchTrainerClientInvitesService = async ({ actorUserId }) => {
  if (!actorUserId) {
    throw new Error("Actor user ID missing. Please login again.");
  }

  const accessToken = Cookies.get("access_token");

  if (!accessToken) {
    throw new Error("Access token missing. Please login again.");
  }

  return apiFetcher(API_ENDPOINTS.ADMINPANEL.TRAINERLISTINVITES, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      actor_user_id: actorUserId,
    }),
  });
};


export const fetchTrainerAdminTrainerSummaryService = async (page = 1) => {
  const actorUserId = getActorUserIdFromAccessToken();

  if (!actorUserId) {
    throw new Error("Session expired. Please login again.");
  }

  return apiFetcher(API_ENDPOINTS.ADMINPANEL.TRAINERADMINTRAINERSUMMARY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Cookies.get("access_token")}`,
    },
    body: JSON.stringify({
      actor_user_id: actorUserId,
      page: page,
    }),
  });
};


// Super admin's trainer summary (super-admin-trainers-summary.php). Same
// request/response shape as the trainer-admin summary; actor_user_id comes
// from the super admin's access token (user_id).
export const fetchSuperAdminTrainerSummaryService = async (page = 1) => {
  const accessToken = Cookies.get("access_token");

  if (!accessToken) {
    throw new Error("Access token missing. Please login again.");
  }

  const actorUserId = getActorUserIdFromAccessToken();

  if (!actorUserId) {
    throw new Error("Session expired. Please login again.");
  }

  return apiFetcher(API_ENDPOINTS.ADMINPANEL.SUPERADMINTRAINERSUMMARY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      actor_user_id: actorUserId,
      page: page,
    }),
  });
};



export const sendTrainerClientInviteService = async ({
  trainerId,
  clientName,
  clientMobile,
  clientEmail,
  planCode,
}) => {
  return apiFetcher(API_ENDPOINTS.ADMINPANEL.SENDTRAINERCLIENTINVITE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Cookies.get("access_token")}`,
    },
    body: JSON.stringify({
      trainer_id: trainerId,
      client_name: clientName,
      client_mobile: clientMobile,
      client_email: clientEmail,
      plan_code: planCode,
    }),
  });
};


export const fetchReferralClientListService = async (page = 1, limit = 10) => {
  const actorUserId = getActorUserIdFromAccessToken();

  if (!actorUserId) {
    throw new Error("Session expired. Please login again.");
  }

  return apiFetcher(API_ENDPOINTS.ADMINPANEL.REFERRALCLIENTLIST, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Cookies.get("access_token")}`,
    },
    body: JSON.stringify({
      actor_user_id: actorUserId,
      page: page,
      limit: limit,
    }),
  });
};


// Fetches the trainer's paid-subscriber sales analytics (summary + paginated rows).
// `purchaseFilter` is one of: this_month | last_month | last_3_months | yearly | custom.
// `userState` is one of: all | active | expired | attention_for_renewal | upcoming.
// For purchaseFilter "custom", pass dateFrom/dateTo (YYYY-MM-DD).
// For userState "attention_for_renewal", pass renewalDays (e.g. 7 or 15).
export const fetchTrainerSalesAnalyticsService = async (
  page = 1,
  limit = 10,
  {
    partnerCode = "",
    purchaseFilter = "this_month",
    userState = "all",
    renewalDays,
    dateFrom = "",
    dateTo = "",
    search = "",
  } = {}
) => {
  const actorId = getActorUserIdFromAccessToken();

  if (!actorId) {
    throw new Error("Session expired. Please login again.");
  }

  const payload = {
    actor_id: actorId,
    purchase_filter: purchaseFilter,
    user_state: userState,
    page: page,
    limit: limit,
  };

  // Only include optional filters when provided so the backend can apply its defaults.
  if (partnerCode) payload.partner_code = partnerCode;
  if (search) payload.search = search;
  if (purchaseFilter === "custom") {
    if (dateFrom) payload.date_from = dateFrom;
    if (dateTo) payload.date_to = dateTo;
  }
  if (userState === "attention_for_renewal" && renewalDays) {
    payload.renewal_days = renewalDays;
  }

  return apiFetcher(API_ENDPOINTS.ADMINPANEL.TRAINERSALESANALYTICS, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
};


export const revokeClientSubscriptionInviteService = async ({ subscriptionId, reason }) => {
  const actorUserId = getActorUserIdFromAccessToken();

  if (!actorUserId) {
    throw new Error("Session expired. Please login again.");
  }

  return apiFetcher(API_ENDPOINTS.ADMINPANEL.REVOKECLIENTSUBSCRIPTIONINVITE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Cookies.get("access_token")}`,
    },
    body: JSON.stringify({
      actor_user_id: actorUserId,
      subscription_id: subscriptionId,
      reason: reason || "",
    }),
  });
};


export const resendClientSubscriptionInviteService = async ({ subscriptionId }) => {
  const actorUserId = getActorUserIdFromAccessToken();

  if (!actorUserId) {
    throw new Error("Session expired. Please login again.");
  }

  return apiFetcher(API_ENDPOINTS.ADMINPANEL.RESENDCLIENTSUBSCRIPTIONINVITE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Cookies.get("access_token")}`,
    },
    body: JSON.stringify({
      actor_user_id: actorUserId,
      subscription_id: subscriptionId,
    }),
  });
};


export const extendClientFreeTrialService = async ({ profileId, reason }) => {
  const actorUserId = getActorUserIdFromAccessToken();

  if (!actorUserId) {
    throw new Error("Session expired. Please login again.");
  }

  return apiFetcher(API_ENDPOINTS.ADMINPANEL.EXTENDCLIENTFREETRIAL14DAYS, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      actor_user_id: actorUserId,
      profile_id: profileId,
      reason: reason || "Extending free trial to 7 days",
    }),
  });
};

