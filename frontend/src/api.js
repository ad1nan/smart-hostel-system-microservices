import axios from "axios";

const BASE_URL = window.__RUNTIME_CONFIG__?.API_URL || process.env.REACT_APP_API_URL || 'http://localhost:4000';
const API = axios.create({
  baseURL: BASE_URL
});

// Attach access token to every request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401 — try to refresh, then retry original request once
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = localStorage.getItem("refreshToken");

      // No refresh token — force logout
      if (!refreshToken) {
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        window.location.href = "/";
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return API(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(
          `${BASE_URL}/auth/refresh`,
          { refreshToken }
        );
        localStorage.setItem("token", data.token);
        localStorage.setItem("refreshToken", data.refreshToken);
        processQueue(null, data.token);
        originalRequest.headers.Authorization = `Bearer ${data.token}`;
        return API(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        window.location.href = "/";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default API;