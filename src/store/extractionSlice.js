import { createSlice } from "@reduxjs/toolkit";

const extractionSlice = createSlice({
  name: "extraction",
  initialState: {
    isExtracting: false,
    progress: 0, 
  },
  reducers: {
    setIsExtracting(state, action) {
      state.isExtracting = !!action.payload;
    },
    setExtractionProgress(state, action) {
      state.progress = Number(action.payload) || 0;
    },
    resetExtraction(state) {
      state.isExtracting = false;
      state.progress = 0;
    },
  },
});

export const {
  setIsExtracting,
  setExtractionProgress,
  resetExtraction,
} = extractionSlice.actions;

export default extractionSlice.reducer;
