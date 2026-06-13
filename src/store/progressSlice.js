// progressSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { fetchClientProfileDetails } from "@/services/authService";
import { cookieManager } from "../lib/cookies";

export const fetchProgressData = createAsyncThunk(
  "progress/fetchProgressData",
  async ({ profileId, range }, { rejectWithValue }) => {
    try {
      const dietitian = cookieManager.getJSON("dietician");
      const dietitianId = dietitian?.dietician_id;

      if (!dietitianId) {
        return rejectWithValue("Dietitian ID not found in cookies");
      }

      const response = await fetchClientProfileDetails(profileId, range, dietitianId);

      if (response?.status && response?.data) {
        // Return the full data structure including graphs
        return response.data;
      } else {
        return rejectWithValue(response?.message || "Failed to fetch data");
      }
    } catch (error) {
      return rejectWithValue(error.message || "An error occurred while fetching data");
    }
  }
);

const initialState = {
  byRange: {},
  loading: {},
  error: {},
  selectedRange: "all_time",
};

const progressSlice = createSlice({
  name: "progress",
  initialState,
  reducers: {
    setSelectedRange: (state, action) => {
      state.selectedRange = action.payload;
    },
    clearProgressData: (state) => {
      state.byRange = {};
      state.loading = {};
      state.error = {};
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProgressData.pending, (state, action) => {
        const range = action.meta.arg.range;
        state.loading[range] = true;
        state.error[range] = null;
      })
      .addCase(fetchProgressData.fulfilled, (state, action) => {
        const range = action.meta.arg.range;
        state.loading[range] = false;
        state.byRange[range] = {
          dietitian_id: action.payload?.dietitian_id || "",
          profile_id: action.payload?.profile_id || "",
          range: action.payload?.range || "",
          range_label: action.payload?.range_label || "",
          graphs: action.payload?.graphs || {},
        };
        state.error[range] = null;
      })
      .addCase(fetchProgressData.rejected, (state, action) => {
        const range = action.meta.arg.range;
        state.loading[range] = false;
        state.error[range] = action.payload || "Failed to fetch progress data";
      });
  },
});

export const { setSelectedRange, clearProgressData } = progressSlice.actions;
export default progressSlice.reducer;