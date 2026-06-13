// store/scoresInsightSlice.js
import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  data: null,
};

const scoresInsightSlice = createSlice({
  name: "scoresInsight",
  initialState,
  reducers: {
    setScoresInsight: (state, action) => {
      state.data = action.payload;
    },
    clearScoresInsight: (state) => {
      state.data = null;
    },
  },
});

export const { setScoresInsight, clearScoresInsight } = scoresInsightSlice.actions;
export default scoresInsightSlice.reducer;
