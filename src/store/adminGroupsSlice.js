// store/adminGroupsSlice.js
// Holds the MANAGEADMINGROUPS (manage_admin_groups.php, action: "list_groups")
// response. It is captured once at login via setAdminGroups(res) and consumed by
// the trainer-admin AnalyticsDashboard. getAdminGroups() re-fetches on demand
// (e.g. after a hard refresh, when the in-memory store has been reset).
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { fetchAdminGroupsService } from "../services/authService";

export const getAdminGroups = createAsyncThunk(
  "adminGroups/get",
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetchAdminGroupsService();
      return response;
    } catch (error) {
      return rejectWithValue(error.message || "Failed to fetch admin groups");
    }
  }
);

const initialState = {
  raw: null,      // full MANAGEADMINGROUPS response, untouched
  groups: [],     // response.groups (the array the dashboard renders from)
  loading: false,
  error: null,
};

const adminGroupsSlice = createSlice({
  name: "adminGroups",
  initialState,
  reducers: {
    // Store the response captured at login without re-fetching.
    setAdminGroups: (state, action) => {
      state.raw = action.payload || null;
      state.groups = Array.isArray(action.payload?.groups) ? action.payload.groups : [];
      state.error = null;
    },
    clearAdminGroups: (state) => {
      state.raw = null;
      state.groups = [];
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getAdminGroups.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getAdminGroups.fulfilled, (state, action) => {
        state.loading = false;
        state.raw = action.payload || null;
        state.groups = Array.isArray(action.payload?.groups) ? action.payload.groups : [];
      })
      .addCase(getAdminGroups.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { setAdminGroups, clearAdminGroups } = adminGroupsSlice.actions;

export const selectAdminGroupsRaw = (state) => state.adminGroups.raw;
export const selectAdminGroups = (state) => state.adminGroups.groups;

// Extract a usable group name from a group entry, tolerant of the exact field
// the API uses (group_name / name / groupName / title).
export const groupNameOf = (group) =>
  group?.group_name ?? group?.name ?? group?.groupName ?? group?.title ?? null;

// The first admin group's name — used as the default target for get_group_details.
export const selectPrimaryGroupName = (state) =>
  groupNameOf(state.adminGroups.groups?.[0]);
export const selectAdminGroupsLoading = (state) => state.adminGroups.loading;
export const selectAdminGroupsError = (state) => state.adminGroups.error;

export default adminGroupsSlice.reducer;
