// store/superAdminAllClientsSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { fetchSuperAdminAllClientsOverviewService } from "../services/authService";

export const getSuperAdminAllClients = createAsyncThunk(
  "superAdminAllClients/get",
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await fetchSuperAdminAllClientsOverviewService(params);
      return response;
    } catch (error) {
      return rejectWithValue(
        error.message || "Failed to fetch network clients overview"
      );
    }
  }
);

const initialState = {
  actor: null,
  filters: null,
  summary: null,
  pagination: null,
  columns: [],
  clients: [],
  mode: null,
  loading: false,
  error: null,
};

const superAdminAllClientsSlice = createSlice({
  name: "superAdminAllClients",
  initialState,
  reducers: {
    clearSuperAdminAllClients: () => initialState,
    // Populate state from a cached response (e.g. paging back to an
    // already-fetched page) without re-hitting the API.
    hydrateSuperAdminAllClients: (state, action) => {
      const payload = action.payload || {};
      state.loading = false;
      state.error = null;
      state.actor = payload.actor || null;
      state.filters = payload.filters || null;
      state.summary = payload.summary || null;
      state.pagination = payload.pagination || null;
      state.columns = payload.columns || [];
      state.clients = payload.clients || [];
      state.mode = payload.mode || null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getSuperAdminAllClients.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getSuperAdminAllClients.fulfilled, (state, action) => {
        const payload = action.payload || {};
        state.loading = false;
        state.actor = payload.actor || null;
        state.filters = payload.filters || null;
        state.summary = payload.summary || null;
        state.pagination = payload.pagination || null;
        state.columns = payload.columns || [];
        state.clients = payload.clients || [];
        state.mode = payload.mode || null;
      })
      .addCase(getSuperAdminAllClients.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearSuperAdminAllClients, hydrateSuperAdminAllClients } =
  superAdminAllClientsSlice.actions;

export const selectAllClientsActor = (state) => state.superAdminAllClients.actor;
export const selectAllClientsFilters = (state) => state.superAdminAllClients.filters;
export const selectAllClientsSummary = (state) => state.superAdminAllClients.summary;
export const selectAllClientsPagination = (state) => state.superAdminAllClients.pagination;
export const selectAllClientsColumns = (state) => state.superAdminAllClients.columns;
export const selectAllClientsList = (state) => state.superAdminAllClients.clients;
export const selectAllClientsLoading = (state) => state.superAdminAllClients.loading;
export const selectAllClientsError = (state) => state.superAdminAllClients.error;

export default superAdminAllClientsSlice.reducer;
