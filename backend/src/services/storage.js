const fs = require("fs");
const path = require("path");
const {
  supabaseUrl,
  supabaseServiceRoleKey,
  supabaseStorageBucket,
} = require("../config");

function isStorageConfigured() {
  return Boolean(
    supabaseUrl && supabaseServiceRoleKey && supabaseStorageBucket,
  );
}

function storageObject(bucket, objectPath) {
  return `supabase://${bucket}/${objectPath}`;
}

function parseStorageObject(value) {
  if (!isStorageObject(value)) return null;
  const match = value.match(/^supabase:\/\/([^/]+)\/(.+)$/);
  return match ? { bucket: match[1], objectPath: match[2] } : null;
}

async function uploadFile(filePath, objectPath, contentType) {
  if (!isStorageConfigured()) return null;
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/${supabaseStorageBucket}/${objectPath}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseServiceRoleKey}`,
        apikey: supabaseServiceRoleKey,
        "Content-Type": contentType || "application/octet-stream",
        "x-upsert": "true",
      },
      body: fs.createReadStream(filePath),
      duplex: "half",
    },
  );
  if (!response.ok)
    throw new Error(`Supabase Storage upload failed (${response.status}).`);
  return storageObject(supabaseStorageBucket, objectPath);
}

async function downloadObject(value) {
  const parsed = parseStorageObject(value);
  if (!parsed || !isStorageConfigured()) return null;
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/${parsed.bucket}/${parsed.objectPath}`,
    {
      headers: {
        Authorization: `Bearer ${supabaseServiceRoleKey}`,
        apikey: supabaseServiceRoleKey,
      },
    },
  );
  if (!response.ok) return null;
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type"),
  };
}

function isStorageObject(value) {
  return typeof value === "string" && value.startsWith("supabase://");
}

function objectPath(prefix, filename) {
  return path.posix.join(
    prefix,
    `${Date.now()}-${path.basename(filename).replace(/\s+/g, "_")}`,
  );
}

module.exports = {
  downloadObject,
  isStorageConfigured,
  isStorageObject,
  objectPath,
  uploadFile,
};
