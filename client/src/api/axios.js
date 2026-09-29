import axios from "axios";

let isPageUnloading = false;
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    isPageUnloading = true;
  });
  window.addEventListener("pagehide", () => {
    isPageUnloading = true;
  });
}

const getBaseURL = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "[::1]" ||
      window.location.hostname === "::1")
  ) {
    return "http://localhost:5000/api";
  }
  return "https://smartbilling-api-het.onrender.com/api";
};

const API = axios.create({
  baseURL: getBaseURL(),
  headers: {
    "Content-Type": "application/json",
  },
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    // When navigating away from a page, in-flight requests may be cancelled by the browser
    // (especially in WebKit/Safari where aborted XHR fires onerror before context teardown).
    // Suppress network error rejection during unload to prevent spurious console error reports.
    if (
      isPageUnloading &&
      (error?.message === "Network Error" ||
        error?.code === "ERR_NETWORK" ||
        !error?.response)
    ) {
      return new Promise(() => {});
    }

    if (
      error.response &&
      error.response.status === 403 &&
      error.response.data?.code === "TRIAL_EXPIRED"
    ) {
      if (
        typeof window !== "undefined" &&
        window.location.pathname !== "/trial-expired"
      ) {
        if (
          error.response.data.company_name ||
          error.response.data.trial_end_at
        ) {
          localStorage.setItem(
            "trial_expired_info",
            JSON.stringify({
              company_name: error.response.data.company_name,
              trial_end_at: error.response.data.trial_end_at,
            })
          );
        }
        window.location.href = "/trial-expired";
      }
    }
    return Promise.reject(error);
  }
);

export default API;