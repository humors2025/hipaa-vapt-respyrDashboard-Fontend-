import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { fetchHabitDetail } from "../services/authService";

export const getHabitDetail = createAsyncThunk(
  "habitDetail/getHabitDetail",
  async ({ profileId, dietitianId, selectedHabitId }, { rejectWithValue }) => {
    try {
      const response = await fetchHabitDetail(
        profileId,
        dietitianId,
        selectedHabitId
      );

      if (response?.status === true) {
        return response;
      }

      return rejectWithValue(
        response || {
          status: false,
          message: "Failed to fetch habit detail",
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

const habitDetailSlice = createSlice({
  name: "habitDetail",

  initialState: {
    loading: false,
    response: null,
    data: null,
    habit: null,
    error: null,
  },

  reducers: {
    clearHabitDetail: (state) => {
      state.loading = false;
      state.response = null;
      state.data = null;
      state.habit = null;
      state.error = null;
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(getHabitDetail.pending, (state) => {
        state.loading = true;
        state.error = null;
      })

      .addCase(getHabitDetail.fulfilled, (state, action) => {
        const fullResponse = action.payload;
        state.loading = false;
        state.response = fullResponse;
        state.data = fullResponse?.data || null;
        state.habit = fullResponse?.data?.habit || null;
        state.error = null;
      })

      .addCase(getHabitDetail.rejected, (state, action) => {
        state.loading = false;
        state.response = action.payload || null;
        state.data = null;
        state.habit = null;
        state.error =
          action.payload?.message || "Failed to fetch habit detail";
      });
  },
});

export const { clearHabitDetail } = habitDetailSlice.actions;
export default habitDetailSlice.reducer;
