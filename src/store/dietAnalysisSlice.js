import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { fetchDietAnalysisPlan } from "../services/authService";
import { cookieManager } from "../lib/cookies";

const initialState = {
  data: null,
  loading: false,
  error: null,
};

export const getDietAnalysisPlan = createAsyncThunk(
  "dietAnalysis/getDietAnalysisPlan",
  async ({ profileId, weekStartDate, weekEndDate }, { rejectWithValue }) => {
    try {
      const dietitianData = cookieManager.getJSON('dietician');
      const dietitianId = dietitianData?.dietician_id || null;

      const response = await fetchDietAnalysisPlan(
        profileId,
        weekStartDate,
        weekEndDate,
        dietitianId  
      );
      return response;
    } catch (error) {
      return rejectWithValue(
        error?.message || "Failed to fetch diet analysis plan"
      );
    }
  }
);

const dietAnalysisSlice = createSlice({
  name: "dietAnalysis",
  initialState,
  reducers: {
    clearDietAnalysis(state) {
      state.data = null;
      state.loading = false;
      state.error = null;
    },
    setWeeklyJsonData(state, action) {
      if (!state.data?.data?.food_json) return;
      state.data.data.food_json.weekly_json_data = {
        ...(state.data.data.food_json.weekly_json_data || {}),
        ...action.payload,
      };
    },
    updateEditedDays(state, action) {
      if (!state.data?.data?.food_json) return;
      const days = action.payload;
      state.data.data.food_json.days = days;
      const totals = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 };
      let nDays = 0;
      for (const day of days || []) {
        nDays += 1;
        for (const slot of ["breakfast", "lunch", "snacks", "dinner"]) {
          const foods = day?.[slot]?.foods || [];
          for (const f of foods) {
            totals.calories += Number(f.calories || 0);
            totals.protein_g += Number(f.protein_g || 0);
            totals.carbs_g += Number(f.carbs_g || 0);
            totals.fat_g += Number(f.fat_g || 0);
            totals.fiber_g += Number(f.fiber_g || 0);
          }
        }
      }
      if (nDays > 0) {
        state.data.data.food_json.weekly_json_data = {
          ...(state.data.data.food_json.weekly_json_data || {}),
          calories: parseFloat((totals.calories / nDays).toFixed(2)),
          protein_g: parseFloat((totals.protein_g / nDays).toFixed(2)),
          carbs_g: parseFloat((totals.carbs_g / nDays).toFixed(2)),
          fat_g: parseFloat((totals.fat_g / nDays).toFixed(2)),
          fiber_g: parseFloat((totals.fiber_g / nDays).toFixed(2)),
        };
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getDietAnalysisPlan.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getDietAnalysisPlan.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
        state.error = null;
      })
      .addCase(getDietAnalysisPlan.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed to fetch diet analysis plan";
      });
  },
});

export const { clearDietAnalysis, updateEditedDays, setWeeklyJsonData } = dietAnalysisSlice.actions;

export const selectDietAnalysisData = (state) => state.dietAnalysis.data;
export const selectDietAnalysisLoading = (state) => state.dietAnalysis.loading;
export const selectDietAnalysisError = (state) => state.dietAnalysis.error;

export default dietAnalysisSlice.reducer;