import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  data: null,        // holds the client profile object
  loading: false,    // optional: for global spinners if you need later
  error: null,       // optional: to store last error
};

const clientProfileSlice = createSlice({
  name: 'clientProfile',
  initialState,
  reducers: {
    setClientProfile(state, action) {
      state.data = action.payload || null;
      state.error = null;
    },
    clearClientProfile(state) {
      state.data = null;
      state.error = null;
    },
    setClientProfileLoading(state, action) {
      state.loading = !!action.payload;
    },
    setClientProfileError(state, action) {
      state.error = action.payload || null;
    },
  },
});

export const {
  setClientProfile,
  clearClientProfile,
  setClientProfileLoading,
  setClientProfileError,
} = clientProfileSlice.actions;

export default clientProfileSlice.reducer;
