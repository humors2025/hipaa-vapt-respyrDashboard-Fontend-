

"use client";

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { fetchClientsWithDietPlan } from "@/services/authService";


export const getClientsForDietician = createAsyncThunk(
  "clients/getClientsForDietician",
  async ({ dieticianId }, { rejectWithValue }) => {
    try {
      const res = await fetchClientsWithDietPlan(dieticianId);
      // Expected shape:
      // { success: true, count: number, data: [...] }
      if (!res?.success) {
        return rejectWithValue(res?.error || "Failed to fetch clients");
      }
      return res;
    } catch (err) {
      return rejectWithValue(err?.message || "Network error");
    }
  }
);

const initialState = {
  status: "idle",       // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null,
  success: false,
  count: 0,
  data: [],            // store the array as-is (simple)
};

const clientsSlice = createSlice({
  name: "clients",
  initialState,
  reducers: {
    // handy if you want to clear state on logout, etc.
    resetClients: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(getClientsForDietician.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(getClientsForDietician.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.success = true;
        state.count = action.payload?.count ?? 0;
        state.data = Array.isArray(action.payload?.data) ? action.payload.data : [];
      })
      .addCase(getClientsForDietician.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload || "Something went wrong";
      });
  },
});

export const { resetClients } = clientsSlice.actions;

// Selectors (simple & reusable)
export const selectClientsStatus = (s) => s.clients.status;
export const selectClientsError = (s) => s.clients.error;
export const selectClientsCount = (s) => s.clients.count;
export const selectClients = (s) => s.clients.data;

export default clientsSlice.reducer;