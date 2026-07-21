// WebRTC utility functions for voice and video calling
// Integrates with Supabase Realtime for signaling

export interface CallSession {
  id: string;
  caller_id: string;
  receiver_id: string;
  channel_id: string | null;
  call_type: 'voice' | 'video';
  status: 'initiated' | 'ringing' | 'accepted' | 'declined' | 'ended' | 'missed' | 'busy' | 'failed';
  started_at: string | null;
  answered_at: string | null;
  ended_at: string | null;
  duration_seconds: number;
  end_reason: string | null;
  created_at: string;
}

export interface CallSignal {
  id: string;
  call_id: string;
  sender_id: string;
  signal_type: 'offer' | 'answer' | 'ice_candidate' | 'ringing' | 'accepted' | 'declined' | 'busy' | 'ended';
  signal_data: any;
  created_at: string;
}

export interface WebRTCConfig {
  iceServers: RTCIceServer[];
}

// Default STUN servers (production MUST configure TURN via env vars for reliable calls)
// Set these environment variables for production:
//   NEXT_PUBLIC_WEBRTC_STUN_URL   (optional override)
//   NEXT_PUBLIC_WEBRTC_TURN_URL
//   NEXT_PUBLIC_WEBRTC_TURN_USERNAME
//   NEXT_PUBLIC_WEBRTC_TURN_CREDENTIAL
export function getWebRTCConfig(): WebRTCConfig {
  const iceServers: RTCIceServer[] = [
    { urls: process.env.NEXT_PUBLIC_WEBRTC_STUN_URL || 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  const turnUrl = process.env.NEXT_PUBLIC_WEBRTC_TURN_URL;
  const turnUsername = process.env.NEXT_PUBLIC_WEBRTC_TURN_USERNAME;
  const turnCredential = process.env.NEXT_PUBLIC_WEBRTC_TURN_CREDENTIAL;

  if (turnUrl && turnUsername && turnCredential) {
    iceServers.push({
      urls: turnUrl,
      username: turnUsername,
      credential: turnCredential,
    });
    console.log('[WebRTC] TURN server configured:', turnUrl);
  } else {
    console.warn(
      '[WebRTC] No TURN server configured. ' +
      'Calls may fail across NAT/mobile networks. ' +
      'Set NEXT_PUBLIC_WEBRTC_TURN_URL, NEXT_PUBLIC_WEBRTC_TURN_USERNAME, NEXT_PUBLIC_WEBRTC_TURN_CREDENTIAL.'
    );
  }

  return { iceServers };
}

export const DEFAULT_WEBRTC_CONFIG: WebRTCConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private config: WebRTCConfig;
  private onRemoteStream: ((stream: MediaStream) => void) | null = null;
  private onIceCandidate: ((candidate: RTCIceCandidate) => void) | null = null;
  private onConnectionStateChange: ((state: RTCPeerConnectionState) => void) | null = null;

  constructor(config: WebRTCConfig = DEFAULT_WEBRTC_CONFIG) {
    this.config = config;
  }

  async initialize(
    callType: 'voice' | 'video',
    onRemoteStream: (stream: MediaStream) => void,
    onIceCandidate: (candidate: RTCIceCandidate) => void,
    onConnectionStateChange: (state: RTCPeerConnectionState) => void
  ): Promise<void> {
    this.onRemoteStream = onRemoteStream;
    this.onIceCandidate = onIceCandidate;
    this.onConnectionStateChange = onConnectionStateChange;

    // Get local media stream
    const constraints: MediaStreamConstraints = {
      audio: true,
      video: callType === 'video',
    };

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      console.error('Error getting media stream:', error);
      throw new Error('Failed to access camera/microphone');
    }

    // Create peer connection
    this.peerConnection = new RTCPeerConnection(this.config);

    // Add local stream tracks to peer connection
    this.localStream.getTracks().forEach((track) => {
      this.peerConnection!.addTrack(track, this.localStream!);
    });

    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        if (this.onRemoteStream) {
          this.onRemoteStream(this.remoteStream);
        }
      }
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.onIceCandidate) {
        this.onIceCandidate(event.candidate);
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      if (this.onConnectionStateChange && this.peerConnection) {
        this.onConnectionStateChange(this.peerConnection.connectionState);
      }
    };
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  async createAnswer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    await this.peerConnection.setRemoteDescription(offer);
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    return answer;
  }

  async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    await this.peerConnection.setRemoteDescription(description);
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    await this.peerConnection.addIceCandidate(candidate);
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  toggleAudio(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  toggleVideo(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  async switchCamera(): Promise<void> {
    if (!this.localStream || !this.peerConnection) {
      throw new Error('No active video stream');
    }

    const videoTrack = this.localStream.getVideoTracks()[0];
    if (!videoTrack) {
      throw new Error('No video track found');
    }

    // Stop current video track
    videoTrack.stop();

    // Get new video stream (facing mode toggle)
    const currentFacingMode = videoTrack.getSettings().facingMode || 'user';
    const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';

    const newStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: newFacingMode },
      audio: false,
    });

    const newVideoTrack = newStream.getVideoTracks()[0];

    // Replace track in peer connection
    const sender = this.peerConnection.getSenders().find(
      (s) => s.track && s.track.kind === 'video'
    );

    if (sender) {
      await sender.replaceTrack(newVideoTrack);
    }

    // Update local stream
    const audioTrack = this.localStream.getAudioTracks()[0];
    this.localStream = new MediaStream([newVideoTrack, audioTrack]);
  }

  cleanup(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.remoteStream = null;
    this.onRemoteStream = null;
    this.onIceCandidate = null;
    this.onConnectionStateChange = null;
  }

  getConnectionState(): RTCPeerConnectionState | null {
    return this.peerConnection?.connectionState || null;
  }

  // True once the peer connection exists (i.e. initialize() has finished
  // acquiring media and creating it) so callers know it's safe to add
  // remote descriptions / ICE candidates instead of racing initialize().
  isReady(): boolean {
    return this.peerConnection !== null;
  }
}

// Format call duration
export function formatCallDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Get call status display text
export function getCallStatusText(status: CallSession['status']): string {
  const statusMap: Record<CallSession['status'], string> = {
    initiated: 'Calling...',
    ringing: 'Ringing...',
    accepted: 'Connected',
    declined: 'Declined',
    ended: 'Ended',
    missed: 'Missed',
    busy: 'Busy',
    failed: 'Failed',
  };
  return statusMap[status] || status;
}

// Check if browser supports WebRTC
export function isWebRTCSupported(): boolean {
  return !!(
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof window.RTCPeerConnection !== 'undefined'
  );
}

// Check if browser supports camera switching
export function supportsCameraSwitching(): boolean {
  return navigator.mediaDevices && 'enumerateDevices' in navigator.mediaDevices;
}
