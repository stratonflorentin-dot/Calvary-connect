"use client";

import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Camera, Upload, CheckCircle2, FileImage, Trash2,
  MapPin, Clock, User, Truck, RefreshCw, PackageCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface PODUploadProps {
  trip: {
    id: string;
    trip_number?: string;
    tripNumber?: string;
    origin: string;
    destination: string;
    status: string;
    cargo_type?: string;
    cargoType?: string;
  };
  open: boolean;
  onClose: () => void;
  onPODUploaded: () => void;
}

interface PODData {
  trip_id: string;
  delivered_at: string;
  recipient_name: string;
  recipient_signature_url?: string;
  delivery_photo_url?: string;
  delivery_notes?: string;
  gps_lat?: number;
  gps_lng?: number;
  delivery_location?: string;
  delivered_by?: string;
}

export function PODUploadDialog({ trip, open, onClose, onPODUploaded }: PODUploadProps) {
  const [recipientName, setRecipientName] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const tripNum = trip?.trip_number || trip?.tripNumber || trip?.id?.slice(0, 8);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + photoFiles.length > 4) {
      toast({ title: "Max 4 photos", description: "Please select up to 4 delivery photos.", variant: "destructive" });
      return;
    }
    const newPreviews = files.map(f => URL.createObjectURL(f));
    setPhotoFiles(prev => [...prev, ...files]);
    setPhotoPreviews(prev => [...prev, ...newPreviews]);
  };

  const removePhoto = (index: number) => {
    setPhotoFiles(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const captureLocation = () => {
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setDeliveryLocation(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
        setGeoLoading(false);
        toast({ title: "Location Captured", description: "GPS coordinates recorded." });
      },
      err => {
        setGeoLoading(false);
        toast({ title: "Location Error", description: "Could not get GPS. Enter manually.", variant: "destructive" });
      },
      { timeout: 10000 }
    );
  };

  const uploadPhoto = async (file: File, index: number): Promise<string | null> => {
    try {
      const ext = file.name.split(".").pop();
      const path = `pod/${trip.id}/${Date.now()}_${index}.${ext}`;
      const { error } = await supabase.storage.from("documents").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("documents").getPublicUrl(path);
      return data.publicUrl;
    } catch {
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!recipientName.trim()) {
      toast({ title: "Recipient Required", description: "Please enter the recipient's name.", variant: "destructive" });
      return;
    }

    try {
      setUploading(true);

      // Upload photos
      const photoUrls: string[] = [];
      for (let i = 0; i < photoFiles.length; i++) {
        const url = await uploadPhoto(photoFiles[i], i);
        if (url) photoUrls.push(url);
      }

      // Save POD record
      const podData: PODData = {
        trip_id: trip.id,
        delivered_at: new Date().toISOString(),
        recipient_name: recipientName,
        delivery_notes: deliveryNotes,
        delivery_location: deliveryLocation,
        delivery_photo_url: photoUrls[0] || undefined,
        gps_lat: coords?.lat,
        gps_lng: coords?.lng,
      };

      // Insert POD record
      const { error: podError } = await supabase
        .from("proof_of_delivery")
        .upsert({ ...podData, photos: photoUrls }, { onConflict: "trip_id" });

      if (podError) {
        // If table doesn't exist yet, try storing on the trip itself
        console.warn("POD table error:", podError);
      }

      // Update trip status to delivered
      const { error: tripError } = await supabase
        .from("trips")
        .update({
          status: "DELIVERED",
          pod_recipient: recipientName,
          pod_notes: deliveryNotes,
          pod_photo_url: photoUrls[0] || null,
          pod_uploaded_at: new Date().toISOString(),
          pod_gps_lat: coords?.lat,
          pod_gps_lng: coords?.lng,
          updated_at: new Date().toISOString(),
        })
        .eq("id", trip.id);

      if (tripError) throw tripError;

      toast({
        title: "✅ POD Submitted",
        description: `Delivery confirmed for trip ${tripNum}. Status updated to Delivered.`,
      });

      onPODUploaded();
      onClose();
      resetForm();
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setRecipientName("");
    setDeliveryNotes("");
    setDeliveryLocation("");
    setPhotoFiles([]);
    setPhotoPreviews([]);
    setCoords(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); resetForm(); } }}>
      <DialogContent className="max-w-lg max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <PackageCheck className="size-5 text-green-600" />
            Proof of Delivery — {tripNum}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Trip Summary */}
          <div className="bg-slate-50 rounded-xl p-3 space-y-1.5 text-sm border">
            <div className="flex items-center gap-2 text-slate-600">
              <Truck className="size-4" />
              <span className="font-medium">{trip?.origin} → {trip?.destination}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              <Clock className="size-4" />
              <span>Delivered: {format(new Date(), "dd MMM yyyy, HH:mm")}</span>
            </div>
            {(trip?.cargo_type || trip?.cargoType) && (
              <Badge variant="outline" className="text-xs">
                {trip.cargo_type || trip.cargoType}
              </Badge>
            )}
          </div>

          {/* Recipient */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 font-medium">
              <User className="size-4 text-blue-600" />
              Recipient Name <span className="text-red-500">*</span>
            </Label>
            <Input
              placeholder="Full name of person who received cargo"
              value={recipientName}
              onChange={e => setRecipientName(e.target.value)}
            />
          </div>

          {/* GPS Location */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 font-medium">
              <MapPin className="size-4 text-red-500" />
              Delivery Location
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="Address or GPS coordinates"
                value={deliveryLocation}
                onChange={e => setDeliveryLocation(e.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={captureLocation}
                disabled={geoLoading}
                className="shrink-0"
              >
                {geoLoading ? <RefreshCw className="size-4 animate-spin" /> : <MapPin className="size-4" />}
              </Button>
            </div>
            {coords && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle2 className="size-3" /> GPS captured: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </p>
            )}
          </div>

          {/* Photos */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 font-medium">
              <Camera className="size-4 text-purple-600" />
              Delivery Photos (max 4)
            </Label>

            {photoPreviews.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {photoPreviews.map((src, i) => (
                  <div key={i} className="relative rounded-xl overflow-hidden border aspect-video bg-slate-100">
                    <img src={src} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {photoFiles.length < 4 && (
              <button
                onClick={() => photoInputRef.current?.click()}
                className="w-full border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center gap-2 hover:border-blue-400 hover:bg-blue-50/50 transition-all text-slate-500"
              >
                <Upload className="size-8" />
                <span className="text-sm font-medium">Click to add photos</span>
                <span className="text-xs">JPEG, PNG up to 10MB each</span>
              </button>
            )}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              className="hidden"
              onChange={handlePhotoSelect}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="font-medium">Delivery Notes</Label>
            <Textarea
              placeholder="Any observations, condition of cargo, special notes…"
              value={deliveryNotes}
              onChange={e => setDeliveryNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => { onClose(); resetForm(); }} disabled={uploading}>
              Cancel
            </Button>
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={handleSubmit}
              disabled={uploading || !recipientName.trim()}
            >
              {uploading ? (
                <><RefreshCw className="size-4 mr-2 animate-spin" />Uploading…</>
              ) : (
                <><CheckCircle2 className="size-4 mr-2" />Confirm Delivery</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── POD Viewer (for already-delivered trips) ─────────────────────────────────
export function PODViewer({ tripId }: { tripId: string }) {
  const [pod, setPod] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useState(() => {
    supabase
      .from("trips")
      .select("pod_recipient, pod_notes, pod_photo_url, pod_uploaded_at, pod_gps_lat, pod_gps_lng")
      .eq("id", tripId)
      .single()
      .then(({ data }) => { setPod(data); setLoading(false); });
  });

  if (loading) return <div className="animate-pulse h-24 bg-slate-100 rounded-xl" />;
  if (!pod?.pod_uploaded_at) return (
    <div className="text-center py-6 text-slate-400 text-sm">
      <FileImage className="size-8 mx-auto mb-2 opacity-30" />
      <p>No POD uploaded yet</p>
    </div>
  );

  return (
    <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2 text-green-700 font-semibold">
        <CheckCircle2 className="size-5" />
        Delivery Confirmed
      </div>
      <div className="text-sm space-y-1.5 text-slate-700">
        <p><span className="font-medium">Recipient:</span> {pod.pod_recipient}</p>
        <p><span className="font-medium">Time:</span> {pod.pod_uploaded_at ? format(new Date(pod.pod_uploaded_at), "dd MMM yyyy, HH:mm") : "—"}</p>
        {pod.pod_notes && <p><span className="font-medium">Notes:</span> {pod.pod_notes}</p>}
        {pod.pod_gps_lat && (
          <a
            href={`https://maps.google.com/?q=${pod.pod_gps_lat},${pod.pod_gps_lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-blue-600 hover:underline text-xs"
          >
            <MapPin className="size-3" />
            View on Map
          </a>
        )}
      </div>
      {pod.pod_photo_url && (
        <img
          src={pod.pod_photo_url}
          alt="Delivery photo"
          className="w-full rounded-lg border object-cover max-h-48"
        />
      )}
    </div>
  );
}
