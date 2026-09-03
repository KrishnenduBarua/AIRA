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

// Upload with real progress events. fetch() cannot report request-body
// progress, and on a slow Bangladeshi mobile connection a statement upload
// without a progress bar looks like a frozen app.
export function uploadWithProgress(path, formData, { onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}${path}`);
    xhr.withCredentials = true;

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(event.loaded / event.total);
      }
    });

    xhr.addEventListener("load", () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText || "{}");
      } catch (_error) {
        data = {};
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
        return;
      }

      const detail =
        typeof data.details === "string"
          ? data.details
          : data.details?.detail || data.details?.message || "";
      const message = data.message || "Something went wrong.";
      reject(
        new Error(detail && detail !== message ? `${message} ${detail}` : message),
      );
    });

    xhr.addEventListener("error", () =>
      reject(new Error("We could not reach AIRA. Check your internet connection.")),
    );
    xhr.addEventListener("abort", () => reject(new Error("Upload cancelled.")));

    xhr.send(formData);
  });
}
