import "server-only";

/**
 * Cliente do backend executado SOMENTE no servidor Next.js.
 * O token (BACKEND_API_TOKEN) nunca chega ao navegador.
 */

const BASE = process.env.BACKEND_URL ?? "http://localhost:8000";
const TOKEN = process.env.BACKEND_API_TOKEN ?? "";

export class BackendError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

function headers(extra?: Record<string, string>): HeadersInit {
  const h: Record<string, string> = { ...extra };
  if (TOKEN) h["X-API-Key"] = TOKEN;
  return h;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* corpo não-JSON */
    }
    throw new BackendError(detail, res.status);
  }
  return (await res.json()) as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/v1${path}`, { headers: headers(), cache: "no-store" });
  } catch {
    throw new BackendError(`Backend indisponível em ${BASE}`, 503);
  }
  return handle<T>(res);
}

export async function apiSend<T>(path: string, method: "POST" | "PATCH", body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/v1${path}`, {
      method,
      headers: headers({ "Content-Type": "application/json" }),
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new BackendError(`Backend indisponível em ${BASE}`, 503);
  }
  return handle<T>(res);
}

export async function apiUpload<T>(path: string, file: File): Promise<T> {
  const form = new FormData();
  form.append("file", file);
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/v1${path}`, { method: "POST", headers: headers(), body: form, cache: "no-store" });
  } catch {
    throw new BackendError(`Backend indisponível em ${BASE}`, 503);
  }
  return handle<T>(res);
}
