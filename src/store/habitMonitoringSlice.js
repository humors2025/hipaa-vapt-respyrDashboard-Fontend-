import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { fetchHabitsMonitoringData } from "../services/authService";

export const getHabitMonitoringData = createAsyncThunk(
  "habitMonitoring/getHabitMonitoringData",
  async ({ profileId, dietitianId }, { rejectWithValue }) => {
    try {
      const response = await fetchHabitsMonitoringData(profileId, dietitianId);

      if (response?.status === true) {
        return response; // full response stored
      }

      return rejectWithValue(
        response || {
          status: false,
          message: "Failed to fetch habit monitoring data",
          data: null,
          error: null,
        }
      );
    } catch (error) {
      return rejectWithValue({
        status: false,
        message:
          error?.data?.message || error?.message || "Something went wrong",
        data: null,
        error: error?.data || error,
      });
    }
  }
);

const habitMonitoringSlice = createSlice({
  name: "habitMonitoring",

  initialState: {
    loading: false,

    // full API response
    response: null,

    // shortcut for response.data
    data: null,

    // shortcut for response.data.habits
    habitList: [],

    error: null,
  },

  reducers: {
    clearHabitMonitoringData: (state) => {
      state.loading = false;
      state.response = null;
      state.data = null;
      state.habitList = [];
      state.error = null;
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(getHabitMonitoringData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })

      .addCase(getHabitMonitoringData.fulfilled, (state, action) => {
        const fullResponse = action.payload;

        state.loading = false;

        // entire API response
        state.response = fullResponse;

        // only data object
        state.data = fullResponse?.data || null;

        // habits list
        state.habitList = fullResponse?.data?.habits || [];

        state.error = null;
      })

      .addCase(getHabitMonitoringData.rejected, (state, action) => {
        state.loading = false;
        state.response = action.payload || null;
        state.data = null;
        state.habitList = [];
        state.error =
          action.payload?.message || "Failed to fetch habit monitoring data";
      });
  },
});

export const { clearHabitMonitoringData } = habitMonitoringSlice.actions;
export default habitMonitoringSlice.reducer;