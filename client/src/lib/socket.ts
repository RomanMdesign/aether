import { io, Socket } from "socket.io-client";
import { getToken } from "./api";

let socket: Socket | null = null;

export function getSocket() {
  if (!socket) {
    const url = import.meta.env.VITE_WS_URL || undefined;
    socket = io(url || "/", {
      autoConnect: false,
      auth: { token: getToken() },
    });
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  s.auth = { token: getToken() };
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  socket?.disconnect();
}
