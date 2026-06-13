import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { fetchClientIndividualProfile } from "../services/authService";

export const getClientIndividualProfile = createAsyncThunk(
  "clientIndividualProfile/getClientIndividualProfile",
  async ({ profileId, date, dietitianId, masking = false }, { rejectWithValue }) => {
    try {
      const response = await fetchClientIndividualProfile(profileId, date, dietitianId, { masking });
      return response;
    } catch (error) {
      return rejectWithValue(
        error?.message || "Failed to fetch client individual profile"
      );
    }
  }
);

const clientIndividualProfileSlice = createSlice({
  name: "clientIndividualProfile",
  initialState: {
    data: null,
    status: "idle",
    error: null,
  },
  reducers: {
    clearClientIndividualProfile: (state) => {
      state.data = null;
      state.status = "idle";
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getClientIndividualProfile.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(getClientIndividualProfile.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.data = action.payload;
      })
      .addCase(getClientIndividualProfile.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload || "Something went wrong";
      });
  },
});

export const { clearClientIndividualProfile } =
  clientIndividualProfileSlice.actions;

export const selectClientIndividualProfileData = (state) =>
  state.clientIndividualProfile.data;

export const selectClientIndividualProfileStatus = (state) =>
  state.clientIndividualProfile.status;

export const selectClientIndividualProfileError = (state) =>
  state.clientIndividualProfile.error;

export default clientIndividualProfileSlice.reducer;