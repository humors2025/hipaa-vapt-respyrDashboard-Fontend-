// store/groupDetailsSlice.js
// Paginated details for a single admin group (get_group_details.php). The target
// group_name comes from the MANAGEADMINGROUPS response held in adminGroupsSlice;
// actor_user_id is decoded from the access_token cookie inside the service.
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { fetchGroupDetailsService } from "../services/authService";

export const getGroupDetails = createAsyncThunk(
  "groupDetails/get",
  async ({ groupName, page = 1, limit = 10, search = "", fetchAll = false } = {}, { rejectWithValue }) => {
    try {
      const first = await fetchGroupDetailsService({ groupName, page, limit, search });

      if (!fetchAll) {
        return { response: first, groupName, page, limit, search };
      }

      // The backend paginates (and caps) the clients list, but the dashboard's
      // Overview totals are derived from the loaded set — so walk every page and
      // accumulate all clients. Trainers/members are not paginated.
      const pag = first?.clients_pagination || {};
      const pageLimit = pag.limit || limit;               // server's actual page size
      let allClients = Array.isArray(first?.clients) ? [...first.clients] : [];
      let curPage = pag.page || page;
      let hasMore = !!pag.has_more;
      let guard = 0;

      while (hasMore && guard < 100) {
        guard++;
        curPage++;
        const next = await fetchGroupDetailsService({ groupName, page: curPage, limit: pageLimit, search });
        if (Array.isArray(next?.clients)) allClients = allClients.concat(next.clients);
        hasMore = !!next?.clients_pagination?.has_more;
      }

      const merged = {
        ...first,
        clients: allClients,
        clients_pagination: { ...pag, page: 1, limit: pageLimit, offset: 0, has_more: false, total: pag.total ?? allClients.length },
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
export const selectGroupDetailsMeta = (state) => ({
  groupName: state.groupDetails.groupName,
  page: state.groupDetails.page,
  limit: state.groupDetails.limit,
  search: state.groupDetails.search,
});
export const selectGroupDetailsLoading = (state) => state.groupDetails.loading;
export const selectGroupDetailsError = (state) => state.groupDetails.error;

export default groupDetailsSlice.reducer;
