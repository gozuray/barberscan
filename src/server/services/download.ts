import { NextResponse } from "next/server";

/**
 * Safely converts a filename to ASCII-only and percent-encodes it for
 * inclusion in `Content-Disposition`. Also returns a UTF-8 variant for
 * browsers that support RFC 5987.
 */
function buildContentDisposition(rawName: string, contentType: string) {
  const ext = contentType.includes("png")
    ? "png"
    : contentType.includes("webp")
      ? "webp"
      : contentType.includes("gif")
        ? "gif"
        : "jpg";

  const safe = rawName
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const asciiFallback = safe.replace(/[^\x20-\x7E]/g, "_") || "photo";
  const filename = `${asciiFallback}.${ext}`;
  const utf8 = encodeURIComponent(`${safe}.${ext}`);

  return `attachment; filename="${filename}"; filename*=UTF-8''${utf8}`;
}

/**
 * Proxies a remote image URL and re-emits it as an attachment so the
 * browser actually triggers a download instead of opening it inline.
 * Works around cross-origin restrictions of the `<a download>` attribute.
 */
export async function streamAsAttachment(imageUrl: string, downloadName: string) {
  const upstream = await fetch(imageUrl, { cache: "no-store" });
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "upstream_fetch_failed" }, { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
  const contentLength = upstream.headers.get("content-length");

  const headers = new Headers({
    "Content-Type": contentType,
    "Content-Disposition": buildContentDisposition(downloadName, contentType),
    "Cache-Control": "private, no-store",
  });
  if (contentLength) headers.set("Content-Length", contentLength);

  return new Response(upstream.body, { status: 200, headers });
}
