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

async function wikipedia(q: string, limit: number, lang = "en"): Promise<SearchHit[]> {
  try {
    const url = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=${limit}&srsearch=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { "user-agent": "BellaVitaeAI/1.0" }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const json = (await res.json()) as { query?: { search?: { title: string; snippet: string }[] } };
    return (json.query?.search ?? []).map((r) => ({
      title: r.title,
      url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, "_"))}`,
      snippet: strip(r.snippet),
    }));
  } catch {
    return [];
  }
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

async function brave(q: string, limit: number): Promise<SearchHit[]> {
  try {
    const res = await fetch(`https://search.brave.com/search?q=${encodeURIComponent(q)}`, {
      headers: { "user-agent": UA, "accept-language": "en,rw;q=0.8" },
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const blocks = html.split('data-type="web"').slice(1);
    const hits: SearchHit[] = [];
    for (const b of blocks) {
      const title = b.match(/search-snippet-title[^"]*"[^>]*title="([^"]*)"/)?.[1];
      const cite = b.match(/<cite[^>]*>([\s\S]*?)<\/cite>/)?.[1];
      const snip = b.match(/class="content [^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1];
      if (!title || !cite) continue;
      const url = strip(cite).replace(/\s*›\s*/g, "/").replace(/\s+/g, "");
      hits.push({ title: strip(title), url: url.startsWith("http") ? url : `https://${url}`, snippet: strip(snip ?? "") });
      if (hits.length >= limit) break;
    }
    return hits;
  } catch {
    return [];
  }
}

/** Free, keyless web search: Brave, then DuckDuckGo Lite, then Wikipedia (English + Kinyarwanda). */
export async function webSearch(query: string, limit = 5): Promise<SearchHit[]> {
  const q = query.trim().slice(0, 300);
  if (!q) return [];
  for (const engine of [brave, ddg]) {
    const hits = await engine(q, limit);
    if (hits.length) return hits;
  }
  const [en, rw] = await Promise.all([wikipedia(q, 3, "en"), wikipedia(q, 3, "rw")]);
  return [...rw, ...en].slice(0, limit);
}
