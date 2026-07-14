export async function uploadBlobToCloudinary(params: {
  blob: Blob;
  path: string;
  contentType: string;
  fileName: string;
  resourceType?: "auto" | "image" | "video";
}) {
  const segments = params.path.split("/").filter(Boolean);
  const folder = segments.length > 1 ? segments.slice(0, -1).join("/") : "";
  const baseName = segments[segments.length - 1] || params.fileName;
  const publicId = baseName.replace(/\.[^.]+$/u, "");
  const formData = new FormData();
  formData.append("file", params.blob, params.fileName);
  formData.append("folder", folder);
  formData.append("publicId", publicId);
  formData.append("contentType", params.contentType);
  formData.append("resourceType", params.resourceType || "auto");

  const response = await fetch("/api/uploads/cloudinary", {
    method: "POST",
    body: formData
  });

  const payload = (await response.json().catch(() => null)) as { ok?: boolean; url?: string; error?: string } | null;
  if (!response.ok || payload?.ok === false || !payload?.url) {
    throw new Error(payload?.error || "Cloudinary upload failed.");
  }
  return payload.url;
}
