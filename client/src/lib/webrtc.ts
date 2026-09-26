type SignalPayload = RTCSessionDescriptionInit | RTCIceCandidateInit;

export class VoiceMesh {
  peers = new Map<string, RTCPeerConnection>();
  localStream: MediaStream | null = null;
  onRemoteStream?: (userId: string, stream: MediaStream) => void;
  onPeerLeft?: (userId: string) => void;

  constructor(
    private iceServers: RTCIceServer[],
    private sendSignal: (targetUserId: string, data: SignalPayload) => void
  ) {}

  async enableMedia(audio = true, video = false) {
    this.localStream = await navigator.mediaDevices.getUserMedia({ audio, video });
    return this.localStream;
  }

  async connectTo(userId: string, initiator: boolean) {
    if (this.peers.has(userId)) return;
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    this.peers.set(userId, pc);

    this.localStream?.getTracks().forEach((t) => pc.addTrack(t, this.localStream!));

    pc.ontrack = (ev) => {
      const stream = ev.streams[0];
      this.onRemoteStream?.(userId, stream);
    };
    pc.onicecandidate = (ev) => {
      if (ev.candidate) this.sendSignal(userId, ev.candidate.toJSON());
    };
    pc.onconnectionstatechange = () => {
      if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
        this.closePeer(userId);
      }
    };

    if (initiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.sendSignal(userId, offer);
    }
  }

  async handleSignal(fromUserId: string, data: RTCSessionDescriptionInit | RTCIceCandidateInit) {
    let pc = this.peers.get(fromUserId);
    if (!pc) {
      await this.connectTo(fromUserId, false);
      pc = this.peers.get(fromUserId)!;
    }
    if ("type" in data && (data.type === "offer" || data.type === "answer")) {
      await pc.setRemoteDescription(data as RTCSessionDescriptionInit);
      if (data.type === "offer") {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.sendSignal(fromUserId, answer);
      }
    } else if ("candidate" in data || (data as RTCIceCandidateInit).candidate) {
      await pc.addIceCandidate(data as RTCIceCandidateInit);
    }
  }

  setMuted(muted: boolean) {
    this.localStream?.getAudioTracks().forEach((t) => {
      t.enabled = !muted;
    });
  }

  closePeer(userId: string) {
    this.peers.get(userId)?.close();
    this.peers.delete(userId);
    this.onPeerLeft?.(userId);
  }

  destroy() {
    this.peers.forEach((pc) => pc.close());
    this.peers.clear();
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
  }
}
