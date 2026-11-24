export type SearchHit = { title: string; url: string; snippet: string };

const strip = (s: string) =>
  s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();

async function ddg(query: string, limit = 5): Promise<SearchHit[]> {
  const q = query.trim().slice(0, 300);
  if (!q) return [];
  try {
    const res = await fetch("https://lite.duckduckgo.com/lite/", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "Mozilla/5.0" },
      body: new URLSearchParams({ q }).toString(),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const links = [...html.matchAll(/href="([^"]+)" class='result-link'>([\s\S]*?)<\/a>/g)];
    const snippets = [...html.matchAll(/class='result-snippet'>([\s\S]*?)<\/td>/g)];
    return links.slice(0, limit).map((m, i) => ({
      url: m[1] ?? "",
      title: strip(m[2] ?? ""),
      snippet: strip(snippets[i]?.[1] ?? ""),
    })).filter((h) => h.url.startsWith("http"));
  } catch {
    return [];
  }
}

async function wikipedia(q: string, limit: number): Promise<SearchHit[]> {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=${limit}&srsearch=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { "user-agent": "BellaVitaeAI/1.0" }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const json = (await res.json()) as { query?: { search?: { title: string; snippet: string }[] } };
    return (json.query?.search ?? []).map((r) => ({
      title: r.title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, "_"))}`,
      snippet: strip(r.snippet),
    }));
  } catch {
    return [];
  }
}

/** Free, keyless web search: DuckDuckGo Lite first, Wikipedia as fallback. Returns [] on failure. */
export async function webSearch(query: string, limit = 5): Promise<SearchHit[]> {
  const hits = await ddg(query, limit);
  if (hits.length) return hits;
  return wikipedia(query.trim().slice(0, 300), limit);
}
