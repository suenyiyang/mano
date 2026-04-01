import axios from "axios";
import { authSession } from "./auth-token.js";

export const apiClient = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// Handle 401 — clear session hint and redirect to login
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const authPaths = ["/auth/login", "/auth/register"];
      if (!authPaths.some((p) => error.config?.url?.endsWith(p))) {
        authSession.markLoggedOut();
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);
