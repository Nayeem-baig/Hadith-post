import { NextResponse } from "next/server";
import { ensureCloudinaryConfigured, cloudinaryReady } from "@/lib/cloudinary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isBlobLike(value: unknown): value is Blob {
  return Boolean(value) && typeof value === "object" && typeof (value as Blob).arrayBuffer === "function";
}

function toBuffer(file: Blob) {
  return file.arrayBuffer().then((buffer) => Buffer.from(buffer));
}

export async function POST(request: Request) {
  if (!cloudinaryReady()) {
    return NextResponse.json({ ok: false, error: "Cloudinary is not configured." }, { status: 500 });
  }

  const formData = await request.formData().catch(() => null);
  const fileEntry = formData?.get("file");
  const folder = String(formData?.get("folder") || "buffer");
  const publicId = String(formData?.get("publicId") || `upload-${Date.now()}`);
  const resourceType = String(formData?.get("resourceType") || "auto") as "auto" | "image" | "video";
  const contentType = String(formData?.get("contentType") || "");

  const file = isBlobLike(fileEntry) ? fileEntry : null;

  if (!file) {
    return NextResponse.json({ ok: false, error: "Missing upload file." }, { status: 400 });
  }

  try {
    const cloudinary = ensureCloudinaryConfigured();
    const buffer = await toBuffer(file);
    const result = await new Promise<{ secure_url?: string; url?: string; public_id?: string; bytes?: number; resource_type?: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: folder || undefined,
          public_id: publicId,
          resource_type: resourceType,
          overwrite: true,
          use_filename: true,
          unique_filename: false,
          format: file.type.startsWith("video/") ? "mp4" : undefined
        },
        (error, uploadResult) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(uploadResult || {});
        }
      );
      stream.end(buffer);
    });

    const url = result.secure_url || result.url;
    if (!url) {
      return NextResponse.json({ ok: false, error: "Cloudinary upload returned no URL." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      url,
      publicId: result.public_id,
      bytes: result.bytes,
      resourceType: result.resource_type || resourceType,
      contentType
    });
  } catch (error) {
    console.error("Cloudinary upload failed:", error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Cloudinary upload failed."
    }, { status: 500 });
  }
}
