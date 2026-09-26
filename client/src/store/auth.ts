import { create } from "zustand";
import { api, setToken, getToken } from "../lib/api";
import { connectSocket, disconnectSocket } from "../lib/socket";

export type User = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  bio?: string | null;
  status?: string;
};

type AuthState = {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (emailOrUsername: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    username: string;
    displayName: string;
    password: string;
  }) => Promise<void>;
  logout: () => void;
  hydrate: () => Promise<void>;
};

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  error: null,
  async login(emailOrUsername, password) {
    set({ error: null });
    const data = await api<{ user: User; token: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ emailOrUsername, password }),
    });
    setToken(data.token);
    set({ user: data.user });
    connectSocket();
  },
  async register(body) {
    set({ error: null });
    const data = await api<{ user: User; token: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    });
    setToken(data.token);
    set({ user: data.user });
    connectSocket();
  },
  logout() {
    setToken(null);
    disconnectSocket();
    set({ user: null });
  },
  async hydrate() {
    if (!getToken()) {
      set({ loading: false, user: null });
      return;
    }
    try {
      const data = await api<{ user: User }>("/api/auth/me");
      set({ user: data.user, loading: false });
      connectSocket();
    } catch {
      setToken(null);
      set({ user: null, loading: false });
    }
  },
}));
