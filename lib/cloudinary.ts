import { v2 as cloudinary } from "cloudinary";

let configured = false;

export function ensureCloudinaryConfigured() {
  if (configured) return cloudinary;
  cloudinary.config({
    secure: true
  });
  configured = true;
  return cloudinary;
}

export function cloudinaryReady() {
  return Boolean(process.env.CLOUDINARY_URL);
}

