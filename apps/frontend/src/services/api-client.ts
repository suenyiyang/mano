import axios from "axios";
import { authToken } from "./auth-token.js";

export const apiClient = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach auth token to every request
apiClient.interceptors.request.use((config) => {
  const token = authToken.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 with silent token refresh
let isRefreshing = false;
let lastRefreshTime = 0;
const REFRESH_COOLDOWN_MS = 5000;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null) => {
  for (const promise of failedQueue) {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token as string);
    }
  }
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Don't intercept auth endpoints — 401 there means bad credentials, not expired token
    const authPaths = ["/auth/login", "/auth/register", "/auth/refresh"];
    if (authPaths.some((p) => originalRequest.url?.endsWith(p))) {
      return Promise.reject(error);
    }

    // Cooldown: if we recently refreshed and still getting 401, don't retry
    if (Date.now() - lastRefreshTime < REFRESH_COOLDOWN_MS) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest._retry = true;
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return apiClient(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    const refreshTokenValue = authToken.getRefresh();
    if (!refreshTokenValue) {
      isRefreshing = false;
      authToken.clear();
      return Promise.reject(error);
    }

    try {
      const { data } = await apiClient.post("/auth/refresh", {
        refreshToken: refreshTokenValue,
      });
      const newToken = data.token;
      const newRefreshToken = data.refreshToken ?? refreshTokenValue;
      authToken.set(newToken, newRefreshToken);
      lastRefreshTime = Date.now();
      processQueue(null, newToken);
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      authToken.clear();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);
