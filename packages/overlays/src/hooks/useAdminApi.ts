const API_BASE = "http://localhost:3001";

interface ApiResult<T = any> {
  data: T | null;
  error: string | null;
}

export async function apiGet<T = any>(path: string): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { data: null, error: body.error ?? `HTTP ${res.status}` };
    }
    const data = await res.json();
    return { data, error: null };
  } catch {
    return { data: null, error: "Cannot connect to server" };
  }
}

export async function apiPut<T = any>(path: string, body: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { data: null, error: data.error ?? `HTTP ${res.status}` };
    }
    const data = await res.json();
    return { data, error: null };
  } catch {
    return { data: null, error: "Cannot connect to server" };
  }
}

export async function apiPost<T = any>(path: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { data: null, error: data.error ?? `HTTP ${res.status}` };
    }
    const data = await res.json();
    return { data, error: null };
  } catch {
    return { data: null, error: "Cannot connect to server" };
  }
}
