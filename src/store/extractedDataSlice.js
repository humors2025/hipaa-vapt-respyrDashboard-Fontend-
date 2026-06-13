import { createSlice } from '@reduxjs/toolkit';

const extractedDataSlice = createSlice({
  name: 'extractedData',
  initialState: {
    data: null,
    isLoading: false,
    error: null,
  },
  reducers: {
    setExtractedData: (state, action) => {
      state.data = action.payload;
      state.isLoading = false;
      state.error = null;
    },
    setExtractedDataLoading: (state, action) => {
      state.isLoading = action.payload;
    },
    setExtractedDataError: (state, action) => {
      state.error = action.payload;
      state.isLoading = false;
    },
    clearExtractedData: (state) => {
      state.data = null;
      state.isLoading = false;
      state.error = null;
    },
  },
});

export const {
  setExtractedData,
  setExtractedDataLoading,
  setExtractedDataError,
  clearExtractedData,
} = extractedDataSlice.actions;

export default extractedDataSlice.reducer;