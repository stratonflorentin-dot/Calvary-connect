"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Phone, Video, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CallSession } from "@/lib/webrtc";

interface IncomingCallModalProps {
  call: CallSession;
  callerName: string;
  callerAvatar?: string;
  onAccept: () => void;
  onDecline: () => void;
  open: boolean;
}

export function IncomingCallModal({
  call,
  callerName,
  callerAvatar,
  onAccept,
  onDecline,
  open,
}: IncomingCallModalProps) {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onDecline()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        {/* Radix requires a DialogTitle for screen readers */}
        <DialogTitle className="sr-only">
          Incoming {call.call_type === "voice" ? "voice" : "video"} call from {callerName}
        </DialogTitle>
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-6 text-center">
          {/* Avatar */}
          <div className="mx-auto mb-4">
            <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
              <AvatarImage src={callerAvatar} alt={callerName} />
              <AvatarFallback className="text-2xl font-bold bg-primary text-primary-foreground">
                {getInitials(callerName)}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Call Type Icon */}
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
            {call.call_type === "voice" ? (
              <Phone className="h-6 w-6" />
            ) : (
              <Video className="h-6 w-6" />
            )}
          </div>

          {/* Caller Name */}
          <h3 className="text-2xl font-bold mb-1">{callerName}</h3>
          <p className="text-muted-foreground text-sm mb-6">
            {call.call_type === "voice" ? "Voice Call" : "Video Call"}
          </p>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-4">
            <Button
              onClick={onDecline}
              size="lg"
              variant="destructive"
              className="h-16 w-16 rounded-full"
            >
              <X className="h-6 w-6" />
            </Button>
            <Button
              onClick={onAccept}
              size="lg"
              className="h-16 w-16 rounded-full bg-green-600 hover:bg-green-700"
            >
              <Phone className="h-6 w-6" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
