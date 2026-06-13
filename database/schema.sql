-- Respyr dietician_db schema (tables only, no data)
-- Extracted from latest_database.sql on 2026-05-23
-- DO NOT add INSERT statements or user data to this file
--
-- ROLE ASSIGNMENTS (reference, maintained in PHP DB):
--   connect@respyr.in  = super_admin (also functions as trainer_admin + trainer, dietician_id=RespyrD01, 28 clients)
--   sagar@respyr.in    = admin (trainer_admin), partner_code=RespyrD03, parent=connect@respyr.in
--   chandan@respyr.in  = admin (trainer_admin), partner_code=ADM6BL3L29, parent=connect@respyr.in
--   ishan@respyr.in    = admin (trainer_admin), partner_code=ADMBWST6GD, parent=connect@respyr.in
--   harsh@respyr.in    = admin (trainer_admin), partner_code=ADM9JQ4CVZ, parent=connect@respyr.in
--   evan.gaudet@gmail.com   = admin (trainer_admin), partner_code=RespyrD05, parent=connect@respyr.in
--   derek.lopez88@gmail.com = admin (trainer_admin), partner_code=RESPYRD06, parent=connect@respyr.in
--   sagarhosur814@gmail.com    = trainer, partner_code=TRAIN0090, parent=sagar@respyr.in
--   tanner.l.staton@gmail.com  = trainer, partner_code=RESPYRD07, parent=evan.gaudet@gmail.com
--   teddy@wunderinteractive.com = trainer, partner_code=RESPYRD08, parent=evan.gaudet@gmail.com
--   snutwell@yahoo.com         = trainer, partner_code=RESPYRD10, parent=evan.gaudet@gmail.com
--   poornesh@respyr.in         = pending invite (trainer_admin), parent=connect@respyr.in
--
-- NOTE: app_user_roles.user_id has a UNIQUE constraint, so connect@respyr.in
-- has only one row (role=super_admin). The app treats super_admin as having
-- all downstream capabilities (trainer_admin + trainer). The RoleSwitcher
-- component allows switching between these views.

SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';

CREATE TABLE `apple_user_data` (
  `id` bigint(20) NOT NULL,
  `apple_user_id` varchar(255) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `full_name` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `app_auth_logs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `event_type` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `partner_code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `identifier_hash` char(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ip_hash` char(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent_hash` char(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `session_id_hash` char(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `success` tinyint(1) NOT NULL DEFAULT '0',
  `failure_reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `app_refresh_token` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `token_hash` varchar(64) NOT NULL,
  `device_info` varchar(255) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `expires_at` datetime NOT NULL,
  `last_used_at` datetime DEFAULT NULL,
  `revoked` tinyint(1) NOT NULL DEFAULT '0',
  `revoked_reason` varchar(100) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `app_user_invitations` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `invited_email` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `invited_first_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `invited_last_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `invited_phone` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `invited_email_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `invited_role` enum('admin','trainer') COLLATE utf8mb4_unicode_ci NOT NULL,
  `partner_code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `invited_by_user_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `parent_user_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `token_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('pending','accepted','expired','revoked') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `expires_at` datetime NOT NULL,
  `sent_at` datetime DEFAULT NULL,
  `accepted_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `app_user_roles` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('super_admin','admin','trainer') COLLATE utf8mb4_unicode_ci NOT NULL,
  `partner_code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parent_user_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('active','suspended','inactive') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `email_verified_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `ble_events` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `session_id` char(36) NOT NULL,
  `ts` datetime(3) DEFAULT NULL,
  `seq` int(10) UNSIGNED NOT NULL DEFAULT '0',
  `screen` varchar(32) NOT NULL,
  `direction` varchar(12) NOT NULL,
  `event_type` varchar(64) NOT NULL,
  `payload_text` longtext,
  `meta_json` json DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `ble_sessions` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `session_id` char(36) NOT NULL,
  `profile_id` varchar(64) NOT NULL,
  `device_id` varchar(64) DEFAULT NULL,
  `device_fw` varchar(32) DEFAULT NULL,
  `platform` varchar(16) DEFAULT NULL,
  `os_version` varchar(32) DEFAULT NULL,
  `phone_model` varchar(64) DEFAULT NULL,
  `app_version` varchar(32) DEFAULT NULL,
  `started_at` datetime(3) DEFAULT NULL,
  `ended_at` datetime(3) DEFAULT NULL,
  `final_status` varchar(32) DEFAULT NULL,
  `final_screen` varchar(32) DEFAULT NULL,
  `final_reason` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `client_habit_tracking` (
  `id` int(11) NOT NULL,
  `profile_id` varchar(100) NOT NULL,
  `selected_habit_id` int(11) NOT NULL,
  `habit_id` int(11) NOT NULL,
  `tracking_date` date NOT NULL,
  `target_count` int(11) NOT NULL DEFAULT '1',
  `completed_count` int(11) NOT NULL DEFAULT '0',
  `is_completed` tinyint(1) NOT NULL DEFAULT '0',
  `notes` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `client_selected_habits` (
  `id` int(11) NOT NULL,
  `profile_id` varchar(100) NOT NULL,
  `habit_id` int(11) NOT NULL,
  `level_id` int(11) NOT NULL DEFAULT '1',
  `start_date` date NOT NULL,
  `end_date` date DEFAULT NULL,
  `status` enum('active','completed','removed') NOT NULL DEFAULT 'active',
  `selected_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `client_subscriptions` (
  `id` int(11) NOT NULL,
  `dietician_id` varchar(50) DEFAULT NULL,
  `profile_id` varchar(50) NOT NULL,
  `client_id` int(11) DEFAULT NULL,
  `coupon_code` varchar(100) NOT NULL,
  `plan_code` varchar(50) NOT NULL,
  `plan_name` varchar(100) NOT NULL,
  `duration_months` int(11) NOT NULL,
  `subscription_start_date` datetime NOT NULL,
  `subscription_end_date` datetime NOT NULL,
  `status` enum('active','expired','cancelled') NOT NULL DEFAULT 'active',
  `activated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `clinical_scores_details` (
  `id` int(30) NOT NULL,
  `login_id` varchar(30) NOT NULL,
  `profile_id` varchar(30) NOT NULL,
  `Db_Score` double NOT NULL,
  `Gut_Score_per` double NOT NULL,
  `liver_score` double NOT NULL,
  `Blow_Score` double NOT NULL,
  `blow_raw_values` text,
  `acetone_ppm` varchar(30) NOT NULL,
  `ethnol_ppm` varchar(30) NOT NULL,
  `h2_ppm` varchar(30) NOT NULL,
  `respiratory_fvc_json` text NOT NULL,
  `dttm` varchar(50) NOT NULL,
  `timestamp` int(11) NOT NULL,
  `hwd` varchar(60) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `countries` (
  `id` int(11) NOT NULL,
  `country_name` varchar(100) NOT NULL,
  `country_code` varchar(10) NOT NULL,
  `telephone_code` varchar(10) NOT NULL DEFAULT '',
  `status` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `coupon_codes` (
  `id` int(11) NOT NULL,
  `coupon_code` varchar(100) NOT NULL,
  `plan_code` varchar(50) NOT NULL,
  `coupon_source` enum('coach','website') NOT NULL,
  `assigned_to_coach_id` varchar(100) DEFAULT NULL,
  `order_id` varchar(100) DEFAULT NULL,
  `purchaser_email` varchar(150) DEFAULT NULL,
  `profile_id` varchar(100) DEFAULT NULL,
  `status` enum('active','used','expired','inactive') NOT NULL DEFAULT 'active',
  `used_at` datetime DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `dietpdf_test` (
  `id` int(10) NOT NULL,
  `login_id` varchar(30) NOT NULL,
  `profile_id` varchar(30) NOT NULL,
  `dttm` varchar(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `dietpdf_testss` (
  `id` bigint(20) NOT NULL,
  `login_id` varchar(64) DEFAULT NULL,
  `profile_id` varchar(64) DEFAULT NULL,
  `mime_type` varchar(128) DEFAULT NULL,
  `payload_len` bigint(20) DEFAULT NULL,
  `sha256` char(64) DEFAULT NULL,
  `dttm` datetime DEFAULT NULL,
  `diet_json` longblob,
  `diet_plan_id` varchar(15) DEFAULT NULL,
  `start_date` datetime DEFAULT NULL,
  `end_date` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `encryp_clinical_scores_details` (
  `id` int(30) NOT NULL,
  `login_id` varchar(30) NOT NULL,
  `profile_id` varchar(30) NOT NULL,
  `Db_Score` text NOT NULL,
  `Gut_Score_per` text NOT NULL,
  `liver_score` text NOT NULL,
  `Blow_Score` text NOT NULL,
  `blow_raw_values` text NOT NULL,
  `acetone_ppm` text,
  `ethnol_ppm` text,
  `h2_ppm` text NOT NULL,
  `respiratory_fvc_json` text NOT NULL,
  `maxpress` double NOT NULL,
  `dttm` varchar(50) NOT NULL,
  `timestamp` int(11) NOT NULL,
  `hwd` varchar(30) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `features_allow` (
  `id` int(11) NOT NULL,
  `dietician_id` varchar(25) NOT NULL,
  `test_allow` tinyint(4) NOT NULL DEFAULT '1',
  `multiple_reading` tinyint(4) DEFAULT '1',
  `practice_test_allow` tinyint(4) DEFAULT '1',
  `detailed_scores` tinyint(4) NOT NULL DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `food_suggestion_weekly` (
  `id` int(30) NOT NULL,
  `dietitian_id` varchar(60) NOT NULL,
  `profile_id` varchar(60) NOT NULL,
  `foods_json` longblob NOT NULL,
  `dttm` date NOT NULL,
  `tstamp` int(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `g2_formula` (
  `id` int(200) NOT NULL,
  `ppmAcetone_1` double NOT NULL,
  `ppmpressure_1` double NOT NULL,
  `best_press` double NOT NULL,
  `max_press` double NOT NULL,
  `ppmEthanol_1` double NOT NULL,
  `temp` double DEFAULT NULL,
  `humidity` double DEFAULT NULL,
  `blow_duration` varchar(20) NOT NULL,
  `bpm` varchar(20) NOT NULL,
  `date` varchar(40) NOT NULL,
  `hwid` varchar(30) NOT NULL,
  `name` varchar(200) DEFAULT NULL,
  `age` varchar(10) DEFAULT NULL,
  `gender` varchar(30) DEFAULT NULL,
  `email` varchar(70) DEFAULT NULL,
  `ph_no` varchar(20) DEFAULT NULL,
  `height` varchar(50) DEFAULT NULL,
  `weight` varchar(15) DEFAULT NULL,
  `daily_water` varchar(90) DEFAULT NULL,
  `alcohol` varchar(200) DEFAULT NULL,
  `smoking` varchar(100) DEFAULT NULL,
  `excercise` varchar(150) DEFAULT NULL,
  `medicine` varchar(250) DEFAULT NULL,
  `medi_name` varchar(500) DEFAULT NULL,
  `disease_his` varchar(200) DEFAULT NULL,
  `disea_disp` varchar(200) DEFAULT NULL,
  `last_hr_wat_food` varchar(100) DEFAULT NULL,
  `tester_id` varchar(70) DEFAULT NULL,
  `login` varchar(90) DEFAULT NULL,
  `dttm_app` varchar(50) DEFAULT NULL,
  `Remark` varchar(100) NOT NULL,
  `sub_id` varchar(100) DEFAULT NULL,
  `sub_intial` varchar(100) DEFAULT NULL,
  `site_no` varchar(100) DEFAULT NULL,
  `disease_level` varchar(100) NOT NULL,
  `sp` varchar(30) NOT NULL,
  `dp` varchar(30) NOT NULL,
  `aceMv` double NOT NULL,
  `h2` double DEFAULT '0',
  `tmstamp` int(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `g2_new_raw_val_humors` (
  `id` int(20) NOT NULL,
  `preval1820` varchar(20) NOT NULL,
  `val1820` varchar(20) NOT NULL,
  `valbest1820` varchar(20) NOT NULL,
  `rawags` varchar(20) NOT NULL,
  `best_ags` varchar(20) NOT NULL,
  `raw_press` varchar(20) NOT NULL,
  `best_press` varchar(20) NOT NULL,
  `max_press` varchar(20) NOT NULL,
  `btemp` double NOT NULL,
  `bbtemp` double NOT NULL,
  `finaltemp` double NOT NULL,
  `blow_duration` varchar(20) NOT NULL,
  `bpm` varchar(20) NOT NULL,
  `spo2` varchar(10) DEFAULT NULL,
  `date` varchar(40) NOT NULL,
  `hwid` varchar(30) NOT NULL,
  `login` varchar(50) DEFAULT NULL,
  `disease` varchar(100) DEFAULT NULL,
  `sub_int` varchar(200) NOT NULL,
  `name` varchar(200) NOT NULL,
  `dlevel` varchar(100) NOT NULL,
  `basflag` varchar(40) NOT NULL,
  `main_val1820` varchar(20) NOT NULL,
  `capacity` varchar(10) NOT NULL,
  `tmstamp` int(40) NOT NULL,
  `raw2600` varchar(30) NOT NULL,
  `best2600` varchar(30) NOT NULL,
  `Base_hum` double NOT NULL DEFAULT '0',
  `Bm0_hum` double NOT NULL DEFAULT '0',
  `resp_factor` varchar(30) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `habit_master` (
  `id` int(11) NOT NULL,
  `level_id` int(11) NOT NULL DEFAULT '1',
  `category` varchar(100) NOT NULL,
  `habit_name` varchar(255) NOT NULL,
  `habit_description` text,
  `frequency_type` enum('daily','weekly','custom') NOT NULL DEFAULT 'daily',
  `target_count` int(11) NOT NULL DEFAULT '1',
  `target_unit` varchar(50) DEFAULT NULL,
  `tracking_type` enum('yes_no','count','value') NOT NULL DEFAULT 'yes_no',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `sort_order` int(11) NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `hardware_device_info` (
  `id` int(11) NOT NULL,
  `device_id` varchar(50) NOT NULL,
  `is_chamber_available` tinyint(1) NOT NULL DEFAULT '0',
  `tstamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE `new_test_new_sensors_acetone_data` (
  `id` int(30) NOT NULL,
  `login_details` varchar(40) NOT NULL,
  `base_raw_value` double NOT NULL,
  `final_raw_value` double NOT NULL,
  `base_ags` double NOT NULL,
  `final_ags` double NOT NULL,
  `h2_raw_base` double NOT NULL,
  `h2_raw_final` double NOT NULL,
  `vo` double NOT NULL,
  `base_temp` varchar(20) NOT NULL,
  `final_temp` varchar(20) NOT NULL,
  `base_humid` varchar(20) NOT NULL,
  `final_humid` varchar(20) NOT NULL,
  `acetone_mv` double NOT NULL,
  `Acetone_Original_VS_V0` double NOT NULL,
  `Adjusted_Acetone_VS_V0` double NOT NULL,
  `acetone_ppm` double NOT NULL,
  `Compensated_Rs_Ro_ratio` double NOT NULL,
  `Correction_factor_H2_RS_R0` double NOT NULL,
  `Correction_factor_ETHANOL_Vs_V0` double NOT NULL,
  `Ethanol_PPM` double NOT NULL,
  `Correction_factor_Acetone_VS_V0` double NOT NULL,
  `H2_PPM` double NOT NULL,
  `Ro` varchar(40) NOT NULL,
  `Rs` varchar(40) NOT NULL,
  `Rs_Ro_ratio` double NOT NULL,
  `Vout_in` double NOT NULL,
  `Vout_out` double NOT NULL,
  `base_press` varchar(20) NOT NULL,
  `final_press` varchar(20) NOT NULL,
  `Blow_fvc_fev_json` text NOT NULL,
  `Device_FEV1` varchar(30) NOT NULL,
  `Predicted_FEV1` varchar(30) NOT NULL,
  `PPM_MEMS` double DEFAULT '0',
  `PPM_MEMS_with_factor` varchar(30) NOT NULL,
  `T_Ref_air` varchar(10) DEFAULT NULL,
  `RH_Ref_air` varchar(10) DEFAULT NULL,
  `ac_hwid_factor` double DEFAULT '0',
  `dttm` varchar(40) NOT NULL,
  `tstammp` int(40) NOT NULL,
  `hwid` varchar(30) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `otp_verifications` (
  `id` int(11) NOT NULL,
  `email` varchar(100) NOT NULL,
  `otp_code` text NOT NULL,
  `purpose` varchar(50) DEFAULT 'login',
  `is_verified` tinyint(1) DEFAULT '0',
  `attempts` int(11) DEFAULT '0',
  `expires_at` datetime NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `verified_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `param_life` (
  `id` int(10) NOT NULL,
  `params` longtext NOT NULL,
  `dttm` varchar(40) NOT NULL,
  `profileid` varchar(40) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `respyr_factor` (
  `id` int(20) NOT NULL,
  `hwid` varchar(30) NOT NULL,
  `acetone` double NOT NULL,
  `acetone_continue_reading` double NOT NULL,
  `ags_factor` double NOT NULL,
  `h2` double NOT NULL,
  `resp_factor` double NOT NULL,
  `update_date` varchar(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `subscription_plans` (
  `id` int(11) NOT NULL,
  `plan_code` varchar(50) NOT NULL,
  `plan_name` varchar(100) NOT NULL,
  `duration_months` int(11) NOT NULL,
  `plan_description` json DEFAULT NULL,
  `status` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `table_chat_threads` (
  `id` int(11) NOT NULL,
  `dietician_id` varchar(50) NOT NULL,
  `profile_id` varchar(50) NOT NULL,
  `last_message` text,
  `last_message_time` datetime DEFAULT NULL,
  `last_sender_id` varchar(50) DEFAULT NULL,
  `unread_count` int(11) DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `table_clients` (
  `id` int(11) NOT NULL,
  `dietician_id` varchar(10) NOT NULL,
  `profile_id` varchar(10) NOT NULL,
  `phone_no` varchar(255) NOT NULL,
  `email` text NOT NULL,
  `profile_name` varchar(255) NOT NULL,
  `profile_image` longblob,
  `dob` varchar(255) DEFAULT 'NA',
  `age` varchar(10) NOT NULL,
  `gender` varchar(10) NOT NULL,
  `height` varchar(10) NOT NULL,
  `weight` varchar(10) NOT NULL,
  `region` varchar(255) NOT NULL,
  `location` varchar(255) NOT NULL,
  `password` text NOT NULL,
  `is_dietitian_linked` tinyint(1) DEFAULT '0',
  `is_notification_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `level_type` tinyint(4) NOT NULL DEFAULT '1',
  `dttm` varchar(20) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `table_conversations` (
  `id` int(11) NOT NULL,
  `id_sender` varchar(20) NOT NULL,
  `id_receiver` varchar(20) NOT NULL,
  `message_type` varchar(20) NOT NULL,
  `txt_message` text NOT NULL,
  `status` tinyint(1) DEFAULT '0',
  `timestamp` varchar(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `table_delete_logs` (
  `id` int(11) NOT NULL,
  `table_name` varchar(100) NOT NULL,
  `record_id` varchar(50) NOT NULL,
  `deleted_by` varchar(50) DEFAULT NULL,
  `reason` text,
  `deleted_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `old_data` json DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `table_dietician` (
  `id` int(11) NOT NULL,
  `dietician_id` varchar(15) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `phone_no` varchar(13) DEFAULT 'NA',
  `email` varchar(150) NOT NULL,
  `location` varchar(20) NOT NULL,
  `logo` longblob NOT NULL,
  `dttm` varchar(25) NOT NULL,
  `password` text NOT NULL,
  `is_reset_password` tinyint(1) DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `table_dietitian_link_requests` (
  `id` int(11) NOT NULL,
  `profile_id` varchar(50) NOT NULL,
  `dietitian_id` varchar(50) DEFAULT NULL,
  `dietitian_name` varchar(255) DEFAULT 'NA',
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `requested_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `responded_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `table_dietitian_test_counts` (
  `id` int(11) NOT NULL,
  `dietician_id` varchar(15) NOT NULL,
  `test_count` int(11) NOT NULL,
  `dttm` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `table_diet_plan_strategy` (
  `id` int(11) NOT NULL,
  `dietitian_id` varchar(15) NOT NULL,
  `client_id` varchar(20) NOT NULL,
  `plan_title` varchar(255) NOT NULL,
  `plan_start_date` date NOT NULL,
  `plan_end_date` date NOT NULL,
  `updated_at` datetime NOT NULL,
  `calories_target` int(11) NOT NULL,
  `protein_target` int(11) NOT NULL,
  `fiber_target` int(11) NOT NULL,
  `carbs_target` int(11) NOT NULL,
  `fat_target` int(11) NOT NULL,
  `water_target` float NOT NULL,
  `goal` text NOT NULL,
  `approach` text NOT NULL,
  `status` varchar(10) NOT NULL DEFAULT 'active',
  `test_no_assigned` varchar(15) NOT NULL,
  `diabetic` tinyint(1) NOT NULL,
  `diet_type` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `table_fcm_tokens` (
  `id` int(11) NOT NULL,
  `user_id` varchar(100) NOT NULL,
  `device_id` varchar(255) DEFAULT NULL,
  `fcm_token` varchar(255) NOT NULL,
  `platform` enum('android','ios','web') DEFAULT 'android',
  `is_active` tinyint(1) DEFAULT '1',
  `last_updated` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `country_reg` varchar(30) NOT NULL DEFAULT 'IN'
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `table_food_log` (
  `id` int(11) NOT NULL,
  `dietician_id` varchar(15) NOT NULL,
  `profile_id` varchar(15) NOT NULL,
  `diet_plan_id` varchar(15) NOT NULL,
  `meal_date` datetime DEFAULT NULL,
  `meal_day` varchar(30) NOT NULL,
  `meal_title` text NOT NULL,
  `meal_name` text NOT NULL,
  `meal_values` text NOT NULL,
  `dttm` varchar(255) NOT NULL,
  `tsstamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `table_last_seen` (
  `id` int(11) NOT NULL,
  `user_id` varchar(50) NOT NULL,
  `user_type` varchar(50) NOT NULL,
  `status` tinyint(1) NOT NULL,
  `dttm_last_sceen` datetime NOT NULL,
  `timestamp` varchar(10) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `table_notifications` (
  `id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `notification_type` enum('message','reminder','promotion','system') NOT NULL DEFAULT 'message',
  `type` enum('user','global','system','reminder','promo') DEFAULT 'user',
  `target_id` varchar(50) DEFAULT NULL,
  `action_type` varchar(50) DEFAULT NULL,
  `action_payload` text,
  `scheduled_time` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `seen_status` varchar(20) NOT NULL DEFAULT 'not_seen'
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `table_sent_meal_reminders` (
  `id` int(11) NOT NULL,
  `client_id` varchar(100) DEFAULT NULL,
  `plan_id` int(11) DEFAULT NULL,
  `meal_label` varchar(255) DEFAULT NULL,
  `reminder_date` date DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `table_test_data` (
  `test_id` int(11) NOT NULL,
  `dietitian_id` varchar(15) NOT NULL,
  `profile_id` varchar(20) NOT NULL,
  `diet_plan_id` varchar(15) NOT NULL,
  `goal_type` varchar(15) DEFAULT NULL,
  `level_type` int(11) DEFAULT '1',
  `absorptive_metabolism_score` double DEFAULT NULL,
  `fermentative_metabolism_score` double DEFAULT NULL,
  `fat_metabolism_score` double DEFAULT NULL,
  `glucose_metabolism_score` double DEFAULT NULL,
  `hepatic_stress_metabolism_score` double DEFAULT NULL,
  `detoxification_metabolism_score` double DEFAULT NULL,
  `fat_loss_metabolism_score` double DEFAULT '0',
  `min_range` varchar(10) NOT NULL DEFAULT '0',
  `max_range` varchar(10) NOT NULL DEFAULT '0',
  `acetone_ppm` double DEFAULT NULL,
  `h2_ppm` double DEFAULT NULL,
  `ethanol_ppm` double DEFAULT NULL,
  `test_json` longblob NOT NULL,
  `date_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `table_test_log` (
  `id` int(11) NOT NULL,
  `test_id` varchar(10) DEFAULT NULL,
  `diet_plan_id` varchar(25) NOT NULL,
  `dietitian_id` varchar(15) NOT NULL,
  `client_id` varchar(25) NOT NULL,
  `test_taken` tinyint(1) NOT NULL DEFAULT '0',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `table_test_reminder_logs` (
  `id` int(11) NOT NULL,
  `dietitian_id` varchar(50) NOT NULL,
  `client_id` varchar(50) NOT NULL,
  `plan_title` varchar(255) DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `token` text NOT NULL,
  `sent_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `remaining_time` varchar(50) DEFAULT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `is_test_mode` tinyint(1) DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `table_water_log` (
  `log_id` int(11) NOT NULL,
  `profile_id` varchar(50) NOT NULL,
  `consumed_ml` int(11) NOT NULL,
  `targeted_ml` int(11) DEFAULT NULL,
  `log_date` date NOT NULL,
  `log_time` time NOT NULL,
  `logged_by` enum('profile','dietitian') NOT NULL,
  `logged_by_id` varchar(50) NOT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `dttm` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `tab_practice_test_status` (
  `id` int(11) NOT NULL,
  `profie_id` varchar(255) NOT NULL,
  `status` tinyint(4) NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `trainer_client_invites` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `trainer_id` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `trainer_code` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_mobile` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `client_email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('sent','accepted','cancelled','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'sent',
  `email_status` enum('sent','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'sent',
  `resend_email_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `accepted_profile_id` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `accepted_at` datetime DEFAULT NULL,
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `user_habits` (
  `id` int(11) NOT NULL,
  `profile_id` varchar(255) NOT NULL,
  `goal` text,
  `activity` text,
  `food_type` text,
  `dttm` date DEFAULT NULL,
  `tsstamp` longtext
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `user_subscriptions` (
  `id` int(11) NOT NULL,
  `profile_id` varchar(100) NOT NULL,
  `coupon_code` varchar(100) NOT NULL,
  `plan_code` varchar(50) NOT NULL,
  `start_date` datetime NOT NULL,
  `end_date` datetime NOT NULL,
  `status` enum('active','expired') NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `weekly_analysis` (
  `id` int(11) NOT NULL,
  `dietician_id` varchar(255) NOT NULL,
  `profile_id` varchar(255) NOT NULL,
  `diet_plan_id` varchar(15) NOT NULL DEFAULT '-1',
  `data_json` longblob NOT NULL,
  `start_date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `end_date` datetime NOT NULL,
  `dttm` datetime NOT NULL,
  `tsstamp` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `weekly_food_json` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `profile_id` varchar(50) NOT NULL,
  `dietitian_id` varchar(50) NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `food_json` json NOT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `weekly_food_json_suggestions` (
  `id` int(11) NOT NULL,
  `dietician_id` varchar(100) NOT NULL,
  `profile_id` varchar(100) NOT NULL,
  `week_start_date` date NOT NULL,
  `week_end_date` date NOT NULL,
  `month_no` tinyint(4) NOT NULL,
  `year_no` smallint(6) NOT NULL,
  `food_json` longtext NOT NULL,
  `source_api_date` date DEFAULT NULL,
  `status` tinyint(1) DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `cal` varchar(10) NOT NULL,
  `cabs` varchar(10) NOT NULL,
  `fats` varchar(10) NOT NULL,
  `Protein` varchar(10) NOT NULL,
  `Fibre` varchar(10) NOT NULL,
  `digestive_score` varchar(10) NOT NULL,
  `recovery_score` varchar(10) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `weight_log` (
  `id` int(11) NOT NULL,
  `profile_id` varchar(255) NOT NULL,
  `weight_kg` decimal(5,2) NOT NULL,
  `target_weight` decimal(5,2) DEFAULT NULL,
  `weight_change_type` enum('weight_loss','weight_gain','no_change') DEFAULT 'no_change',
  `weight_progress` enum('on_track','off_track','no_change') DEFAULT 'no_change',
  `logged_by` enum('dietitian','client') NOT NULL,
  `logged_by_id` varchar(255) NOT NULL,
  `notes` text,
  `log_date` date NOT NULL,
  `log_time` time NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- Indexes and auto-increment
ALTER TABLE `apple_user_data`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `apple_user_id` (`apple_user_id`);

ALTER TABLE `app_auth_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_app_auth_logs_user_id` (`user_id`),
  ADD KEY `idx_app_auth_logs_event_type` (`event_type`),
  ADD KEY `idx_app_auth_logs_success` (`success`),
  ADD KEY `idx_app_auth_logs_created_at` (`created_at`),
  ADD KEY `idx_app_auth_logs_identifier_hash` (`identifier_hash`);

ALTER TABLE `app_refresh_token`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_token_hash` (`token_hash`),
  ADD KEY `idx_expires_at` (`expires_at`);

ALTER TABLE `app_user_invitations`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_app_user_invitations_token_hash` (`token_hash`),
  ADD UNIQUE KEY `uq_app_user_invitations_partner_code` (`partner_code`),
  ADD KEY `idx_app_user_invitations_email` (`invited_email`),
  ADD KEY `idx_app_user_invitations_email_hash` (`invited_email_hash`),
  ADD KEY `idx_app_user_invitations_status` (`status`),
  ADD KEY `idx_app_user_invitations_role` (`invited_role`),
  ADD KEY `idx_app_user_invitations_invited_by` (`invited_by_user_id`),
  ADD KEY `idx_app_user_invitations_parent` (`parent_user_id`),
  ADD KEY `idx_app_user_invitations_expires_at` (`expires_at`);

ALTER TABLE `app_user_roles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_app_user_roles_user_id` (`user_id`),
  ADD UNIQUE KEY `uq_app_user_roles_partner_code` (`partner_code`),
  ADD KEY `idx_app_user_roles_role` (`role`),
  ADD KEY `idx_app_user_roles_parent_user_id` (`parent_user_id`),
  ADD KEY `idx_app_user_roles_status` (`status`);

ALTER TABLE `ble_events`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_session_seq` (`session_id`,`seq`),
  ADD KEY `idx_session_ts` (`session_id`,`ts`),
  ADD KEY `idx_session_seq` (`session_id`,`seq`);

ALTER TABLE `ble_sessions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_session_id` (`session_id`),
  ADD KEY `idx_profile_id` (`profile_id`),
  ADD KEY `idx_started_at` (`started_at`);

ALTER TABLE `client_habit_tracking`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_daily_habit` (`profile_id`,`selected_habit_id`,`tracking_date`),
  ADD KEY `selected_habit_id` (`selected_habit_id`),
  ADD KEY `idx_profile_date` (`profile_id`,`tracking_date`),
  ADD KEY `idx_habit_date` (`habit_id`,`tracking_date`);

ALTER TABLE `client_selected_habits`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_profile_id` (`profile_id`),
  ADD KEY `idx_profile_status` (`profile_id`,`status`),
  ADD KEY `idx_habit_status` (`habit_id`,`status`);

ALTER TABLE `client_subscriptions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_profile_id` (`profile_id`),
  ADD KEY `idx_coupon_code` (`coupon_code`),
  ADD KEY `idx_plan_code` (`plan_code`),
  ADD KEY `idx_status` (`status`);

ALTER TABLE `clinical_scores_details`
  ADD PRIMARY KEY (`id`),
  ADD KEY `login_id` (`login_id`),
  ADD KEY `profile_id` (`profile_id`);

ALTER TABLE `countries`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `coupon_codes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `coupon_code` (`coupon_code`);

ALTER TABLE `dietpdf_test`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `dietpdf_testss`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `encryp_clinical_scores_details`
  ADD PRIMARY KEY (`id`),
  ADD KEY `login_id` (`login_id`),
  ADD KEY `profile_id` (`profile_id`);

ALTER TABLE `features_allow`
  ADD UNIQUE KEY `dietician_id` (`dietician_id`),
  ADD UNIQUE KEY `id` (`id`);

ALTER TABLE `food_suggestion_weekly`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `g2_formula`
  ADD PRIMARY KEY (`id`),
  ADD KEY `hwid` (`hwid`),
  ADD KEY `name` (`name`);

ALTER TABLE `g2_new_raw_val_humors`
  ADD PRIMARY KEY (`id`),
  ADD KEY `hwid` (`hwid`);

ALTER TABLE `habit_master`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `hardware_device_info`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_device_id` (`device_id`);

ALTER TABLE `new_test_new_sensors_acetone_data`
  ADD PRIMARY KEY (`id`),
  ADD KEY `login_details` (`login_details`);

ALTER TABLE `otp_verifications`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_email_purpose` (`email`,`purpose`),
  ADD KEY `idx_email` (`email`);

ALTER TABLE `param_life`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `respyr_factor`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `hwid` (`hwid`);

ALTER TABLE `subscription_plans`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `plan_code` (`plan_code`);

ALTER TABLE `table_chat_threads`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_thread` (`dietician_id`,`profile_id`),
  ADD KEY `idx_thread_dietician_lasttime` (`dietician_id`,`last_message_time`);

ALTER TABLE `table_clients`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_table_clients_profile_id` (`profile_id`);

ALTER TABLE `table_conversations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_conv_sender_receiver_time` (`id_sender`,`id_receiver`,`timestamp`),
  ADD KEY `idx_conv_receiver_status` (`id_receiver`,`status`,`timestamp`);

ALTER TABLE `table_delete_logs`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `table_dietician`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `dietician_id` (`dietician_id`);

ALTER TABLE `table_dietitian_link_requests`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `table_dietitian_test_counts`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `table_diet_plan_strategy`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `table_fcm_tokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_fcm_token` (`fcm_token`),
  ADD UNIQUE KEY `uniq_device_platform` (`device_id`,`platform`),
  ADD KEY `idx_user_device` (`user_id`,`device_id`);

ALTER TABLE `table_food_log`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `table_last_seen`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `table_notifications`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `table_sent_meal_reminders`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_meal` (`client_id`,`plan_id`,`meal_label`,`reminder_date`);

ALTER TABLE `table_test_data`
  ADD PRIMARY KEY (`test_id`),
  ADD KEY `idx_profile_date` (`profile_id`,`date_time`),
  ADD KEY `dietitian_id` (`dietitian_id`),
  ADD KEY `idx_72hr_fetch_unique_user` (`date_time`,`dietitian_id`,`profile_id`,`test_id`);

ALTER TABLE `table_test_log`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `table_test_reminder_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `client_id` (`client_id`),
  ADD KEY `dietitian_id` (`dietitian_id`),
  ADD KEY `sent_at` (`sent_at`);

ALTER TABLE `table_water_log`
  ADD PRIMARY KEY (`log_id`),
  ADD KEY `idx_water_profile_id` (`profile_id`);

ALTER TABLE `tab_practice_test_status`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `profie_id` (`profie_id`);

ALTER TABLE `trainer_client_invites`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_trainer_client_email` (`trainer_id`,`client_email`),
  ADD KEY `idx_trainer_id` (`trainer_id`),
  ADD KEY `idx_trainer_code` (`trainer_code`),
  ADD KEY `idx_client_email` (`client_email`),
  ADD KEY `idx_status` (`status`);

ALTER TABLE `user_habits`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_habits_profile_id` (`profile_id`);

ALTER TABLE `user_subscriptions`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `weekly_analysis`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_weekly_composite` (`dietician_id`,`profile_id`,`diet_plan_id`,`start_date`,`end_date`);

ALTER TABLE `weekly_food_json`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_profile_week` (`profile_id`,`start_date`,`end_date`),
  ADD KEY `idx_dietitian` (`dietitian_id`),
  ADD KEY `idx_profile` (`profile_id`);

ALTER TABLE `weekly_food_json_suggestions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_profile_week` (`profile_id`,`week_start_date`),
  ADD KEY `idx_profile_month_year` (`profile_id`,`month_no`,`year_no`),
  ADD KEY `idx_week_start_date` (`week_start_date`);

ALTER TABLE `weight_log`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `apple_user_data`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

ALTER TABLE `app_auth_logs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=543;

ALTER TABLE `app_refresh_token`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

ALTER TABLE `app_user_invitations`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=32;

ALTER TABLE `app_user_roles`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

ALTER TABLE `ble_events`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=664074;

ALTER TABLE `ble_sessions`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2940;

ALTER TABLE `client_habit_tracking`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=247;

ALTER TABLE `client_selected_habits`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=331;

ALTER TABLE `client_subscriptions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `clinical_scores_details`
  MODIFY `id` int(30) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2393;

ALTER TABLE `countries`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

ALTER TABLE `coupon_codes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

ALTER TABLE `dietpdf_test`
  MODIFY `id` int(10) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

ALTER TABLE `dietpdf_testss`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=61;

ALTER TABLE `encryp_clinical_scores_details`
  MODIFY `id` int(30) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2393;

ALTER TABLE `features_allow`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=25;

ALTER TABLE `food_suggestion_weekly`
  MODIFY `id` int(30) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

ALTER TABLE `g2_formula`
  MODIFY `id` int(200) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2503;

ALTER TABLE `g2_new_raw_val_humors`
  MODIFY `id` int(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2502;

ALTER TABLE `habit_master`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=51;

ALTER TABLE `hardware_device_info`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

ALTER TABLE `new_test_new_sensors_acetone_data`
  MODIFY `id` int(30) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2509;

ALTER TABLE `otp_verifications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

ALTER TABLE `param_life`
  MODIFY `id` int(10) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12421;

ALTER TABLE `respyr_factor`
  MODIFY `id` int(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=231;

ALTER TABLE `subscription_plans`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

ALTER TABLE `table_chat_threads`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

ALTER TABLE `table_clients`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=294;

ALTER TABLE `table_conversations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

ALTER TABLE `table_delete_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=20;

ALTER TABLE `table_dietician`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=48;

ALTER TABLE `table_dietitian_link_requests`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

ALTER TABLE `table_dietitian_test_counts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

ALTER TABLE `table_diet_plan_strategy`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=63;

ALTER TABLE `table_fcm_tokens`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8751;

ALTER TABLE `table_food_log`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=50;

ALTER TABLE `table_last_seen`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `table_notifications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=95;

ALTER TABLE `table_sent_meal_reminders`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1492;

ALTER TABLE `table_test_data`
  MODIFY `test_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2414;

ALTER TABLE `table_test_log`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=142;

ALTER TABLE `table_test_reminder_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=169;

ALTER TABLE `table_water_log`
  MODIFY `log_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

ALTER TABLE `tab_practice_test_status`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=71;

ALTER TABLE `trainer_client_invites`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=36;

ALTER TABLE `user_habits`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=59;

ALTER TABLE `user_subscriptions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
