
import { configureStore } from "@reduxjs/toolkit";
import clientsReducer from "./clientSlice";
import pdfReducer  from "./pdfSlice";
import extractedDataReducer from "./extractedDataSlice";
import clientProfileReducer from "./clientProfileSlice";
import scoresInsightReducer from "./scoresInsightSlice";
import extractionReducer from './extractionSlice';
import dateReducer from "./dateSlice";
import clientsDashboardReducer from "./clientsDashboardSlice";
import clientIndividualProfileReducer from "./clientIndividualProfileSlice";
import progressReducer from "./progressSlice";
import dietAnalysisReducer from "./dietAnalysisSlice";
import macroSummaryReducer from "./macroSummarySlice";
import habitMonitoringReducer from "./habitMonitoringSlice";
import habitDetailReducer from "./habitDetailSlice";
import trainerDirectionReducer from "./trainerDirectionSlice";
import superAdminOverviewReducer from "./superAdminOverviewSlice";
import superAdminAllClientsReducer from "./superAdminAllClientsSlice";


export const store = configureStore({
  reducer: {
    clients: clientsReducer,
      clients: clientsDashboardReducer,
      pdf: pdfReducer,
      extractedData: extractedDataReducer,
       clientProfile: clientProfileReducer,
       scoresInsight: scoresInsightReducer,
      extraction: extractionReducer,
      date: dateReducer,
      clientIndividualProfile: clientIndividualProfileReducer,
       progress: progressReducer,
        dietAnalysis: dietAnalysisReducer,
        macroSummary: macroSummaryReducer,
      habitMonitoring: habitMonitoringReducer,
      habitDetail: habitDetailReducer,
      trainerDirection: trainerDirectionReducer,
      superAdminOverview: superAdminOverviewReducer,
      superAdminAllClients: superAdminAllClientsReducer,
  },

  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['pdf/setUploadedFile'],
        ignoredPaths: ['pdf.uploadedFile'],
      },
    }),

});

