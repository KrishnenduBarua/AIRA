export const API_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined"
    ? `http://${window.location.hostname}:4000`
    : "http://localhost:4000");

export async function request(path, options = {}) {
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: isFormData
      ? options.headers || {}
      : { "Content-Type": "application/json", ...(options.headers || {}) },
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json().catch(() => ({}))
    : {};

  if (!response.ok) {
    const detail =
      typeof data.details === "string"
        ? data.details
        : data.details?.detail || data.details?.message || "";
    const message = data.message || "Something went wrong.";
    throw new Error(detail && detail !== message ? `${message} ${detail}` : message);
  }
  return data;
}
