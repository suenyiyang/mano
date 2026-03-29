import "./i18n.js";
import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import "./app.css";
import { router } from "./routes.js";
import { queryClient } from "./services/query-client.js";

// biome-ignore lint/style/noNonNullAssertion: root element is guaranteed in index.html
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
