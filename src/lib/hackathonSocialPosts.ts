export function getHackathonSocialPostEmbed(raw: string): { url: string; platform: string } | null {
  let link: URL;
  try {
    link = new URL(raw.trim());
  } catch {
    return null;
  }
  if (link.protocol !== "https:" || link.username || link.password || link.port) return null;
  const host = link.hostname.toLowerCase();
  const path = link.pathname;
  if (["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(host)) {
    const match = path.match(/^\/[^/]+\/status\/(\d+)\/?$/);
    return match ? { platform: "X", url: `https://platform.twitter.com/embed/Tweet.html?id=${match[1]}` } : null;
  }
  if (["instagram.com", "www.instagram.com"].includes(host)) {
    const match = path.match(/^\/(p|reel)\/([A-Za-z0-9_-]+)\/?$/);
    return match ? { platform: "Instagram", url: `https://www.instagram.com/${match[1]}/${match[2]}/embed/` } : null;
  }
  if (["facebook.com", "www.facebook.com", "m.facebook.com"].includes(host) &&
    (/\/posts\/[^/]+/.test(path) || /\/permalink\.php$/.test(path) || /\/share\/p\/[^/]+/.test(path))) {
    return { platform: "Facebook", url: `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(link.href)}&show_text=true&width=500` };
  }
  return null;
}
