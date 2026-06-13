// store/trainerDirectionSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { fetchTrainerDirection } from "../services/authService";

export const getTrainerDirection = createAsyncThunk(
  "trainerDirection/get",
  async ({ profileId, dietitianId, date }, { rejectWithValue }) => {
    try {
      const response = await fetchTrainerDirection(profileId, dietitianId, date);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || "Failed to fetch trainer direction");
    }
  }
);

const trainerDirectionSlice = createSlice({
  name: "trainerDirection",
  initialState: {
    data: null,
    loading: false,
    error: null,
  },
  reducers: {
    clearTrainerDirection: (state) => {
      state.data = null;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getTrainerDirection.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getTrainerDirection.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(getTrainerDirection.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearTrainerDirection } = trainerDirectionSlice.actions;
export const selectTrainerDirectionData = (state) => state.trainerDirection.data;
export const selectTrainerDirectionLoading = (state) => state.trainerDirection.loading;
export const selectTrainerDirectionError = (state) => state.trainerDirection.error;

export default trainerDirectionSlice.reducer;