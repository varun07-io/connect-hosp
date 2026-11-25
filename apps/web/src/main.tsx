import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/context/AuthContext";
import { CompareProvider } from "@/context/CompareContext";
import { isTransportError } from "@/lib/apiClient";
import App from "@/App";
import "leaflet/dist/leaflet.css";
import "@/index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retry only transport failures (flaky link, cold tunnel on a shared
      // preview URL) — an HTTP error like 401/403/404 is a real answer and
      // retrying it just delays showing the user the truth.
      retry: (failureCount, error) => isTransportError(error) && failureCount < 3,
      retryDelay: (attempt) => 600 * (attempt + 1),
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <CompareProvider>
            <App />
          </CompareProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
