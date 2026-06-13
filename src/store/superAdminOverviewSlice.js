// store/superAdminOverviewSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { fetchSuperAdminOverviewService } from "../services/authService";

export const getSuperAdminOverview = createAsyncThunk(
  "superAdminOverview/get",
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetchSuperAdminOverviewService();
      return response;
    } catch (error) {
      return rejectWithValue(error.message || "Failed to fetch super admin overview");
    }
  }
);

const superAdminOverviewSlice = createSlice({
  name: "superAdminOverview",
  initialState: {
    actor: null,
    overview: null,
    network: null,
    title: null,
    mode: null,
    loading: false,
    error: null,
  },
  reducers: {
    clearSuperAdminOverview: (state) => {
      state.actor = null;
      state.overview = null;
      state.network = null;
      state.title = null;
      state.mode = null;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getSuperAdminOverview.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getSuperAdminOverview.fulfilled, (state, action) => {
        state.loading = false;
        state.actor = action.payload?.actor || null;
        state.overview = action.payload?.overview || null;
        state.network = action.payload?.network || null;
        state.title = action.payload?.title || null;
        state.mode = action.payload?.mode || null;
      })
      .addCase(getSuperAdminOverview.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearSuperAdminOverview } = superAdminOverviewSlice.actions;

export const selectSuperAdminActor = (state) => state.superAdminOverview.actor;
export const selectSuperAdminOverview = (state) => state.superAdminOverview.overview;
export const selectSuperAdminNetwork = (state) => state.superAdminOverview.network;
export const selectSuperAdminOverviewTitle = (state) => state.superAdminOverview.title;
export const selectSuperAdminOverviewLoading = (state) => state.superAdminOverview.loading;
export const selectSuperAdminOverviewError = (state) => state.superAdminOverview.error;

export default superAdminOverviewSlice.reducer;
