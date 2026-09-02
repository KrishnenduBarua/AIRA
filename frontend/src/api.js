const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

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

  if (!response.ok) throw new Error(data.message || "Something went wrong.");
  return data;
}
