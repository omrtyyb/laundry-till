// Talking to the till server, in one place.
//
//   loadJson(url)            reads a list or report and gives back what the server sent
//   request(url, options)    sends a change; gives back { ok, data }
//                            (ok is false when the server said no, and data.error says why)
//
// Examples:
//   const products = await loadJson("/api/products");
//   const { ok, data } = await request("/api/sales", { method: "POST", body: sale });
//   if (!ok) showToast(data.error, "error");
//
// Downloads (Excel) and the streamed backup progress still call fetch() themselves,
// because they read the answer as a file or a stream, not as JSON.

const NOT_ANSWERING = "The till server is not answering";

export async function loadJson(url) {
  const response = await fetch(url);
  return response.json();
}

export async function request(url, { method = "GET", body } = {}) {
  const hasBody = body !== undefined && body !== null;
  const response = await fetch(url, {
    method,
    headers: hasBody ? { "Content-Type": "application/json" } : undefined,
    body: hasBody ? JSON.stringify(body) : undefined,
  });
  // A crashed or stopped server can answer with a plain error page instead of JSON
  const data = await response.json().catch(() => (response.ok ? {} : { error: NOT_ANSWERING }));
  return { ok: response.ok, data };
}
