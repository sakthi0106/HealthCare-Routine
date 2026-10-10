// One place for every call to the backend. The browser never talks to Google Sheets.
const BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const TOKEN_KEY = "fhc_token";
const ROLE_KEY = "fhc_role";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const getRole = () => localStorage.getItem(ROLE_KEY);
export const saveSession = (token, role) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ROLE_KEY, role);
};
export const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
};

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth && getToken()) headers.Authorization = `Bearer ${getToken()}`;

  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError("Cannot reach the server. Please check the internet and try again.", 0);
  }
  if (res.status === 401 && auth) {
    clearSession();
    window.dispatchEvent(new Event("fhc-auth-expired"));
    throw new ApiError("Please sign in again.", 401);
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    throw new ApiError(typeof data?.detail === "string" ? data.detail : "Something went wrong. Please try again.", res.status);
  }
  return data;
}
