// store/groupDetailsSlice.js
// Paginated details for a single admin group (get_group_details.php). The target
// group_name comes from the MANAGEADMINGROUPS response held in adminGroupsSlice;
// actor_user_id is decoded from the access_token cookie inside the service.
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { fetchGroupDetailsService } from "../services/authService";

export const getGroupDetails = createAsyncThunk(
  "groupDetails/get",
  async ({ groupName, page = 1, limit = 10, search = "", trainerLimit = 100, overviewDate = "", fetchAll = false } = {}, { rejectWithValue }) => {
    try {
      const first = await fetchGroupDetailsService({ groupName, page, limit, search, trainerPage: 1, trainerLimit, overviewDate });

      if (!fetchAll) {
        return { response: first, groupName, page, limit, search };
      }

      // The backend paginates (and caps) BOTH lists — clients (page/limit) and
      // trainers (trainer_page/trainer_limit) — but the dashboard's Overview totals
      // and the Trainer Adoption / Client Engagement tables are derived from the
      // loaded set, so walk every page of each and accumulate the full lists.
      const pag = first?.clients_pagination || {};
      const pageLimit = pag.limit || limit;               // server's actual page size
      let allClients = Array.isArray(first?.clients) ? [...first.clients] : [];
      let curPage = pag.page || page;
      let hasMore = !!pag.has_more;
      let guard = 0;

      while (hasMore && guard < 100) {
        guard++;
        curPage++;
        const next = await fetchGroupDetailsService({ groupName, page: curPage, limit: pageLimit, search, trainerPage: 1, trainerLimit: 1, overviewDate });
        if (Array.isArray(next?.clients)) allClients = allClients.concat(next.clients);
        hasMore = !!next?.clients_pagination?.has_more;
      }

      // Same walk for trainers. trainer_limit is high enough that this normally
      // finishes on the first response, but a group larger than the cap still loads
      // completely instead of silently stopping at the first page.
      const tPag = first?.trainers_pagination || {};
      const tPageLimit = tPag.limit || trainerLimit;
      let allTrainers = Array.isArray(first?.trainers) ? [...first.trainers] : [];
      let tCurPage = tPag.page || 1;
      let tHasMore = !!tPag.has_more;
      let tGuard = 0;

      while (tHasMore && tGuard < 100) {
        tGuard++;
        tCurPage++;
        const next = await fetchGroupDetailsService({ groupName, page: 1, limit: 1, search: "", trainerPage: tCurPage, trainerLimit: tPageLimit, overviewDate });
        if (Array.isArray(next?.trainers)) allTrainers = allTrainers.concat(next.trainers);
        tHasMore = !!next?.trainers_pagination?.has_more;
      }

      const merged = {
        ...first,
        clients: allClients,
        clients_pagination: { ...pag, page: 1, limit: pageLimit, offset: 0, has_more: false, total: pag.total ?? allClients.length },
        trainers: allTrainers,
        trainers_pagination: { ...tPag, page: 1, limit: tPageLimit, offset: 0, has_more: false, total: tPag.total ?? allTrainers.length },
      };
      return { response: merged, groupName, page, limit, search };
    } catch (error) {
      return rejectWithValue(error.message || "Failed to fetch group details");
    }
  }
);

const initialState = {
  data: null,        // full get_group_details response (all client pages merged)
  counts: null,      // { members, trainers, clients } — authoritative group totals
  periodOverview: null, // { date_from, date_to, total_readings, trainer_readings, client_readings }
  groupName: null,   // group these details belong to
  page: 1,
  limit: 10,
  search: "",
  loading: false,
  error: null,
};

const groupDetailsSlice = createSlice({
  name: "groupDetails",
  initialState,
  reducers: {
    clearGroupDetails: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(getGroupDetails.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getGroupDetails.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload.response || null;
        state.counts = action.payload.response?.counts || null;
        state.periodOverview = action.payload.response?.period_overview || null;
        state.groupName = action.payload.groupName;
        state.page = action.payload.page;
        state.limit = action.payload.limit;
        state.search = action.payload.search;
      })
      .addCase(getGroupDetails.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearGroupDetails } = groupDetailsSlice.actions;

export const selectGroupDetails = (state) => state.groupDetails.data;
export const selectGroupCounts = (state) => state.groupDetails.counts;
export const selectPeriodOverview = (state) => state.groupDetails.periodOverview;
export const selectGroupDetailsMeta = (state) => ({
  groupName: state.groupDetails.groupName,
  page: state.groupDetails.page,
  limit: state.groupDetails.limit,
  search: state.groupDetails.search,
});
export const selectGroupDetailsLoading = (state) => state.groupDetails.loading;
export const selectGroupDetailsError = (state) => state.groupDetails.error;

export default groupDetailsSlice.reducer;
