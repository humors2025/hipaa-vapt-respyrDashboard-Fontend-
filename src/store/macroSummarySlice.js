// store/macroSummarySlice.js

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { fetchMacroSummaryByDate } from "../services/authService";

// Async thunk to fetch macro summary
export const getMacroSummary = createAsyncThunk(
  "macroSummary/getMacroSummary",
  async ({ profileId, date }) => {
    const response = await fetchMacroSummaryByDate(profileId, date);
    return response;
  }
);

const macroSummarySlice = createSlice({
  name: "macroSummary",
  initialState: {
    data: null,
    loading: false,
    error: null,
  },
  reducers: {
    clearMacroSummary: (state) => {
      state.data = null;
      state.loading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getMacroSummary.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getMacroSummary.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
        state.error = null;
      })
      .addCase(getMacroSummary.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to fetch macro summary";
      });
  },
});

export const { clearMacroSummary } = macroSummarySlice.actions;

// Selectors
export const selectMacroSummaryData = (state) => state.macroSummary.data;
export const selectMacroSummaryLoading = (state) => state.macroSummary.loading;
export const selectMacroSummaryError = (state) => state.macroSummary.error;

export default macroSummarySlice.reducer;