import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  uploadedFile: null,
  blobUrl: null,
  fileName: ''
};

const pdfSlice = createSlice({
  name: 'pdf',
  initialState,
  reducers: {
    setUploadedFile: (state, action) => {
      state.uploadedFile = action.payload.file;
      state.blobUrl = action.payload.blobUrl;
      state.fileName = action.payload.fileName;
    },
    clearUploadedFile: (state) => {
      state.uploadedFile = null;
      state.blobUrl = null;
      state.fileName = '';
    }
  }
});

export const { setUploadedFile, clearUploadedFile } = pdfSlice.actions;
export default pdfSlice.reducer;