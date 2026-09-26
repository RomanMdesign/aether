const API = import.meta.env.VITE_API_URL || "";

export function getToken() {
  return localStorage.getItem("aether_token");
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem("aether_token", token);
  else localStorage.removeItem("aether_token");
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || res.statusText);
  return data as T;
}
