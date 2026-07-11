"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Mic, MicOff, PhoneOff, Volume2, VolumeX } from "lucide-react";
import { CallSession, formatCallDuration } from "@/lib/webrtc";

interface ActiveCallUIProps {
  call: CallSession;
  userName: string;
  userAvatar?: string;
  localStream?: MediaStream | null;
  remoteStream?: MediaStream | null;
  isMuted: boolean;
  isSpeakerOn: boolean;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  onEndCall: () => void;
}

export function ActiveCallUI({
  call,
  userName,
  userAvatar,
  localStream,
  remoteStream,
  isMuted,
  isSpeakerOn,
  onToggleMute,
  onToggleSpeaker,
  onEndCall,
}: ActiveCallUIProps) {
  const [duration, setDuration] = useState(0);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Update duration
  useEffect(() => {
    if (call.status !== 'accepted') return;
    
    const startTime = call.answered_at ? new Date(call.answered_at).getTime() : Date.now();
    
    const interval = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [call.status, call.answered_at]);

  // Attach streams to video elements
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={userAvatar} alt={userName} />
            <AvatarFallback>{getInitials(userName)}</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold">{userName}</h3>
            <p className="text-sm text-muted-foreground">
              {call.call_type === "voice" ? "Voice Call" : "Video Call"}
            </p>
          </div>
        </div>
        <div className="text-lg font-mono font-medium">
          {formatCallDuration(duration)}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center relative">
        {call.call_type === "video" ? (
          <>
            {/* Remote Video */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            
            {/* Local Video (Picture-in-Picture) */}
            {localStream && (
              <div className="absolute bottom-24 right-4 w-32 h-48 bg-black rounded-lg overflow-hidden shadow-lg border-2 border-background">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </>
        ) : (
          /* Voice Call - Show Avatar */
          <div className="text-center">
            <Avatar className="h-32 w-32 mx-auto mb-4">
              <AvatarImage src={userAvatar} alt={userName} />
              <AvatarFallback className="text-4xl font-bold bg-primary text-primary-foreground">
                {getInitials(userName)}
              </AvatarFallback>
            </Avatar>
            <h2 className="text-2xl font-bold mb-2">{userName}</h2>
            <p className="text-muted-foreground">{formatCallDuration(duration)}</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-6 border-t bg-background">
        <div className="flex items-center justify-center gap-4">
          <Button
            onClick={onToggleMute}
            size="lg"
            variant={isMuted ? "destructive" : "secondary"}
            className="h-16 w-16 rounded-full"
          >
            {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </Button>
          
          <Button
            onClick={onEndCall}
            size="lg"
            variant="destructive"
            className="h-20 w-20 rounded-full"
          >
            <PhoneOff className="h-8 w-8" />
          </Button>
          
          <Button
            onClick={onToggleSpeaker}
            size="lg"
            variant={isSpeakerOn ? "secondary" : "outline"}
            className="h-16 w-16 rounded-full"
          >
            {isSpeakerOn ? <Volume2 className="h-6 w-6" /> : <VolumeX className="h-6 w-6" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
