const VIDEO_FILE_EXTS = [".mp4", ".webm", ".mov"];

export function isLocalVideo(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.startsWith("/uploads/") &&
    VIDEO_FILE_EXTS.some((ext) => lower.endsWith(ext))
  );
}

export function getEmbedUrl(url: string, autoplay: boolean): string | null {
  if (!url) return null;
  if (isLocalVideo(url)) return null;
  try {
    const parsed = new URL(url, "https://placeholder.com");
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v");
      if (!id) return null;
      const params = new URLSearchParams();
      params.set("autoplay", "1");
      params.set("mute", "1");
      params.set("rel", "0");
      return `https://www.youtube.com/embed/${id}?${params.toString()}`;
    }
    if (parsed.hostname === "youtu.be") {
      const id = parsed.pathname.slice(1);
      if (!id) return null;
      const params = new URLSearchParams();
      params.set("autoplay", "1");
      params.set("mute", "1");
      params.set("rel", "0");
      return `https://www.youtube.com/embed/${id}?${params.toString()}`;
    }
    if (parsed.hostname.includes("vimeo.com")) {
      const id = parsed.pathname.split("/").filter(Boolean).pop();
      if (!id) return null;
      const params = new URLSearchParams();
      params.set("autoplay", "1");
      params.set("muted", "1");
      return `https://player.vimeo.com/video/${id}?${params.toString()}`;
    }
    if (parsed.hostname !== "placeholder.com") return url;
    return null;
  } catch {
    return null;
  }
}

export function getBackgroundEmbedUrl(url: string): string | null {
  if (!url) return null;
  if (isLocalVideo(url)) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v");
      if (!id) return null;
      return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&showinfo=0&modestbranding=1&rel=0`;
    }
    if (parsed.hostname === "youtu.be") {
      const id = parsed.pathname.slice(1);
      if (!id) return null;
      return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&showinfo=0&modestbranding=1&rel=0`;
    }
    if (parsed.hostname.includes("vimeo.com")) {
      const id = parsed.pathname.split("/").filter(Boolean).pop();
      if (!id) return null;
      return `https://player.vimeo.com/video/${id}?autoplay=1&muted=1&loop=1&background=1`;
    }
    return null;
  } catch {
    return null;
  }
}
