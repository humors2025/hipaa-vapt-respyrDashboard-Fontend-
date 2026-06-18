
// config/apiConfig.js

// Base URLs (different for local, staging, prod)
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.respyr.ai";

// API version for the Node/Lambda backend (bump to v2, v3… in one place)
export const API_VERSION =
  process.env.NEXT_PUBLIC_API_VERSION || "v1";

// Centralized API endpoints
export const API_ENDPOINTS = {
  AUTH: {
    // LOGIN: "/humors_app/app_final/dieticianapp/web/api/dietician_login",
    LOGIN: `/${API_VERSION}/auth/login`,
    REFRESH_TOKEN: `/${API_VERSION}/auth/refresh-token`,
     SEND_OTP: `/${API_VERSION}/auth/send_diatitian_otp`,
     VERIFY_OTP: `/${API_VERSION}/auth/verify_diatitian_otp`, 
    // SEND_OTP: `/${API_VERSION}/humors_app/app_final/dieticianapp/web/api/send_diatitian_otp`,
    RESET_PASSWORD: `/${API_VERSION}/auth/update_diatitian_password`,
    DIETPLANSTATUS: `/${API_VERSION}/dietitian/api/web/update_diet_plan_status`,
    UPDATEPASSWORDSERVICE: `/${API_VERSION}/dietitian/api/web/reset_password`
  },
  CLIENT: {
    CLIENTTABLE: `/${API_VERSION}/dietitian/api/web/get_clients_with_diet_plan`,
    CLIENTS_DASHBOARD: `/${API_VERSION}/dietitian/api/web/get-clients-data-total-missed-test`,
    CLIENTS_DASHBOARD_MASKED: `/${API_VERSION}/dietitian/api/web/get-clients-data-total-missed-test-masked`,
    TRAINERADMINCLIENTSLISTDIR: `/${API_VERSION}/dietitian/api/web/trainer-admin-clients-list-dir`,
  },
  CALENDER: {
    CALENDERTABLE: `/${API_VERSION}/dietitian/api/web/get_calander_fill_data`
  },
  PROFILESCOREANALYSIS: {
    GRAPH: `/${API_VERSION}/dietitian/api/web/get_score_trend1`,
    SCORESINSIGHT: `/${API_VERSION}/dietitian/api/web/get_latest_test_by_date`
  },
  PLAN: {
    PLANSUMMARYFORM: `/${API_VERSION}/dietitian/api/web/insert_diet_plan_strategy`,
    DIETPLAN: `/${API_VERSION}/dietitian/api/web/update_diet_plan_json`,
    DIETPLANJSON: `/${API_VERSION}/dietitian/api/web/fetch_diet_json`,
    DELETEDIETPLAN: `/${API_VERSION}/dietitian/api/web/delete_diet_plan`,
    UPDATEDIETFOOD: `/${API_VERSION}/dietitian/api/web/trainer-update-weekly-food-json`
  },
  CLIENTPROFILE: {
    CLIENTPROFILEDATA: `/${API_VERSION}/dietitian/api/web/get_client_data`,
    CLIENTPROFILEDETAILS: `/${API_VERSION}/dietitian/api/web/get-graph-all-seven-trends-graph`,
    CLIENTINDIVIDUALPROFILE: `/${API_VERSION}/dietitian/api/web/get-data-points-score-all-ranges-coach`,
    CLIENTINDIVIDUALPROFILEMASKING: `/${API_VERSION}/dietitian/api/web/get-data-points-score-all-ranges-coach-masking`,
    CLIENTPROFILEDATESLIST: `/${API_VERSION}/dietitian/api/web/get-profile-details-dates-taken`,
    CLIENTWEEKLYDATES: `/${API_VERSION}/dietitian/api/web/get-weekly-tab-list`,
    GETCLIENTPROFILEDETAILS: `/${API_VERSION}/dietitian/api/web/get_client_profile_details`

  },
  MEALANALYSIS: {
    WEEKLYANALYSISCOMPLETE: `/${API_VERSION}/dietitian/api/web/weekly_analysis_complete`,
    //  WEEKLYANALYSISCOMPLETE1:"/dietitian/api/web/weekly_analysis_complete1",
    WEEKLYANALYSISCOMPLETE1: `/${API_VERSION}/dietitian/api/web/weekly_analysis_complete_lambda`,
    CHECKWEEKLYANALYSIS: `/${API_VERSION}/dietitian/api/web/check_weekly_analysis`,
    ADDFOOD: `/${API_VERSION}/dietitian/api/web/save_weekly_food_json`,
    GETFOOD: `/${API_VERSION}/dietitian/api/web/get_save_weekly_food_json`
  },
  DASHBOARD: {
    TABLECARDS: `/${API_VERSION}/dietitian/api/web/test_statistic_by_dietitian`,
    TESTANALYTICS: `/${API_VERSION}/dietitian/api/web/get_test_analytics`
  },
  TESTINFO: {
    TESTREMAINING: `/${API_VERSION}/dietitian/api/web/get_test_stat`
  },
  PLANHISTORY: {
    CLIENTLOG: `/${API_VERSION}/dietitian/api/app/get_diet_plan_statistics`
  },
  SEARCH: {
    SEARCHCLIENT: `/${API_VERSION}/dietitian/api/web/get-search-clients-details`
  },
  DIETANALYSIS: {
    DIETANALYSISPLAN: `/${API_VERSION}/dietitian/api/web/get_weekly_food_json_suggestions_weeks`,
    APPROVALPLAN: `/${API_VERSION}/dietitian/api/web/food_json_suggestion_approve_plan`
  },
  MACROSANALYSIS: {
    GETMACROSUMMARY: `/${API_VERSION}/dietitian/api/web/get_macro_summary_by_date`
  },
  HABITMONITORING: {
    GETHABITSDATA: `/${API_VERSION}/dietitian/api/web/habits-tracking-users-choice1`,
    GETHABITDETAIL: `/${API_VERSION}/dietitian/api/web/get-client-selected-habit-detail`
  },
  LEVELUPDATE: {
    LEVEL: `/${API_VERSION}/dietitian/api/web/level-type-update-change`
  },
  TRAINER: {
    TRAINERDIRECTION: `/${API_VERSION}/dietitian/api/web/get_trainer_direction`
  },
  ADMINPANEL: {
    INVITETRAINERADMIN: `/${API_VERSION}/dietitian/api/web/super-admin-invite-admin`,
    SUPERADMINOVERVIEW: `/${API_VERSION}/dietitian/api/web/super-admin-overview`,
    TRAINERADMINLIST: `/${API_VERSION}/dietitian/api/web/list-admin-trainer-users`,
    LISTALLTRAINERSFORSUPERADMIN: `/${API_VERSION}/dietitian/api/web/list-all-trainers-for-super-admin`,
    SUPERADMINALLCLIENTSOVERVIEW: `/${API_VERSION}/dietitian/api/web/super-admin-all-clients-overview`,
    TRAINERCLIENTSOVERVIEWFORSUPERADMIN: `/${API_VERSION}/dietitian/api/web/trainer-clients-overview-for-super-admin`,
    REVOKETRAINERADMININVITE: `/${API_VERSION}/dietitian/api/web/revoke-admin-invite`,
    RESENDUSERINVITE: `/${API_VERSION}/dietitian/api/web/resend-user-invite`,
    REVOKEUSERINVITE: `/${API_VERSION}/dietitian/api/web/revoke-user-invite`,

    INVITETRAINER: `/${API_VERSION}/dietitian/api/web/admin-invite-trainer`,
    SUPERADMININVITETRAINER: `/${API_VERSION}/dietitian/api/web/super-admin-invite-trainer`,
    TRAINERLISTINVITES: `/${API_VERSION}/dietitian/api/web/trainer-admin-overview`,
    REVOKETRAINERCLIENTINVITE: `/${API_VERSION}/dietitian/api/web/revoke-trainer-client-invite`,
    TRAINERADMINTRAINERSUMMARY: `/${API_VERSION}/dietitian/api/web/trainer-admin-trainers-summary`,
    SUPERADMINTRAINERSUMMARY: `/${API_VERSION}/dietitian/api/web/super-admin-trainers-summary`,
    SUPERADMINREVOKETRAINER: `/${API_VERSION}/dietitian/api/web/super-admin-revoke-trainers`,
    SUPERADMINRESENDTRAINER: `/${API_VERSION}/dietitian/api/web/super-admin-resend-trainers`,
    SENDTRAINERCLIENTINVITE: `/${API_VERSION}/dietitian/api/web/send_trainer_client_invite`,
    REFERRALCLIENTLIST: `/${API_VERSION}/dietitian/api/web/referral-client-list`,
    REVOKECLIENTSUBSCRIPTIONINVITE: `/${API_VERSION}/dietitian/api/web/revoke-client-subscription-invite`,
    RESENDCLIENTSUBSCRIPTIONINVITE: `/${API_VERSION}/dietitian/api/web/resend-client-subscription-invite`,


    VALIDATEINVITETOKEN: `/${API_VERSION}/dietitian/api/web/validate-invite-token`,
    ACCEPTINVITE: `/${API_VERSION}/dietitian/api/web/accept-invite`,
    AGREEMENTUPLOADURL: `/${API_VERSION}/dietitian/api/web/agreement-upload-url`,
    INVITEPREVIEW: `/${API_VERSION}/dietitian/api/web/invite-preview`,

    // Internal Next.js API routes (relative — not prefixed with API_BASE_URL)
    LISTUSERSINTERNAL: "/api/admin/list-users"
  }


};