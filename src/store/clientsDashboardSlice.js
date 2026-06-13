import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  clients: [],
  summary: {
    all_total: 0,
    tested_total: 0,
    missed_total: 0,
  },
};

const clientsDashboardSlice = createSlice({
  name: "clientsDashboard",
  initialState,
  reducers: {
    setClients: (state, action) => {
      state.clients = action.payload;
    },

    setSummary: (state, action) => {
      state.summary = action.payload;
    },

    clearClientsDashboard: (state) => {
      state.clients = [];
      state.summary = {
        all_total: 0,
        tested_total: 0,
        missed_total: 0,
      };
    },
  },
});

export const { setClients, setSummary, clearClientsDashboard } =
  clientsDashboardSlice.actions;

export default clientsDashboardSlice.reducer;