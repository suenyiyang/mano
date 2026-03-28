import { createBrowserRouter } from "react-router";
import { App } from "./app.js";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: App,
  },
]);
