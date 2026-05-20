"use client";

import { useSupabase } from '@/components/supabase-provider';
import { useRole } from '@/hooks/use-role';
import { supabase } from '@/lib/supabase';
import { Sidebar } from '@/components/navigation/sidebar';
import { BottomTabs } from '@/components/navigation/bottom-tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, FileImage, CheckCircle2, Shield, FileText, Eye, ExternalLink, Camera, X, RotateCcw, PenLine } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { toast } from '@/hooks/use-toast';
import { uploadToBucket, uploadDataUrl } from '@/lib/storage-upload';
import { createNotification } from '@/services/notification-service';

export default function DeliveryProofPage() {
  const { user } = useSupabase();
  const { role, isAdmin } = useRole();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [insuranceDocuments, setInsuranceDocuments] = useState<any[]>([]);
  const [assignedVehicle, setAssignedVehicle] = useState<any>(null);
  const [loadingInsurance, setLoadingInsurance] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  
  // Camera capture state
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const signCanvasRef = useRef<HTMLCanvasElement>(null);
  const signDrawing = useRef(false);

  // Load driver's assigned vehicle and insurance documents
  useEffect(() => {
    const loadDriverInsuranceDocs = async () => {
      if (!user || role !== 'DRIVER') return;
      
      try {
        setLoadingInsurance(true);
        
        // Get driver's assigned vehicle from trips or driver profile
        const { data: driverTrips } = await supabase
          .from('trips')
          .select('vehicle_id, vehicles!inner(*)')
          .eq('driver_id', user.id)
          .eq('status', 'in_progress')
          .limit(1)
          .single();
          
        if (driverTrips?.vehicle_id) {
          setAssignedVehicle(driverTrips.vehicles);
          
          // Load insurance documents for assigned vehicle
          const { data: insuranceDocs } = await supabase
            .from('vehicle_documents')
            .select('*')
            .eq('vehicle_id', driverTrips.vehicle_id)
            .eq('document_type', 'insurance')
            .eq('status', 'active')
            .order('created_at', { ascending: false });
            
          setInsuranceDocuments(insuranceDocs || []);
        }
      } catch (error) {
        console.error('Error loading insurance documents:', error);
      } finally {
        setLoadingInsurance(false);
      }
    };

    loadDriverInsuranceDocs();
  }, [user, role]);

  const handleViewDocument = (doc: any) => {
    setSelectedDoc(doc);
    setViewDialogOpen(true);
  };

  // Camera functions
  const startCamera = async () => {
    try {
      // Try environment camera first (back camera), fall back to any camera
      const constraints = {
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false 
      };
      
      let mediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        // Fallback to any available camera
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false 
        });
      }
      
      setStream(mediaStream);
      setShowCamera(true);
      
      // Wait for next render then set video source
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
          };
        }
      }, 100);
      
    } catch (err) {
      console.error('Error accessing camera:', err);
      toast({
        title: "Camera Error",
        description: "Could not access camera. Please check permissions.",
        variant: "destructive"
      });
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Ensure video is playing and has valid dimensions
      if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        toast({
          title: "Camera not ready",
          description: "Please wait for camera to initialize",
          variant: "destructive"
        });
        return;
      }
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Draw the video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert to JPEG with high quality
        const imageData = canvas.toDataURL('image/jpeg', 0.95);
        setCapturedImage(imageData);
        stopCamera();
      }
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    startCamera();
  };

  const clearPhoto = () => {
    setCapturedImage(null);
  };

  if (!user || !role) return null;

  const startSign = () => {
    setSigning(true);
    setSignatureDataUrl(null);
  };

  const clearSignature = () => {
    const canvas = signCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setSignatureDataUrl(null);
  };

  const saveSignature = () => {
    const canvas = signCanvasRef.current;
    if (!canvas) return;
    setSignatureDataUrl(canvas.toDataURL('image/png'));
    setSigning(false);
  };

  const drawSign = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = signCanvasRef.current;
    if (!canvas || !signDrawing.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const point = 'touches' in e
      ? { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
      : { x: e.clientX - rect.left, y: e.clientY - rect.top };
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111';
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);

    try {
      const form = new FormData(e.currentTarget);
      const tripRef = String(form.get('tripId') || '');
      const notes = String(form.get('notes') || '');

      let deliveryPhotoUrl: string | null = null;
      if (capturedImage) {
        deliveryPhotoUrl = await uploadDataUrl('vehicle-documents', 'delivery-proofs', capturedImage, `photo-${Date.now()}.png`);
      }
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      const uploadFile = documentFile || fileInput?.files?.[0];
      if (uploadFile && !deliveryPhotoUrl) {
        deliveryPhotoUrl = await uploadToBucket('vehicle-documents', 'delivery-proofs', uploadFile);
      }

      let documentUrl: string | null = null;
      if (documentFile) {
        documentUrl = await uploadToBucket('vehicle-documents', 'delivery-documents', documentFile);
      }

      let customerSignature: string | null = signatureDataUrl;
      if (signatureDataUrl) {
        const sigUrl = await uploadDataUrl('vehicle-documents', 'signatures', signatureDataUrl, `sig-${Date.now()}.png`);
        customerSignature = sigUrl || signatureDataUrl;
      }

      const deliveredAt = new Date().toISOString();
      const { error } = await supabase.from('delivery_proofs').insert([{
        trip_id: tripRef,
        driver_id: user.id,
        delivery_photo_url: deliveryPhotoUrl,
        document_url: documentUrl,
        delivery_notes: notes,
        customer_signature: customerSignature,
        delivered_at: deliveredAt,
      }]);

      if (error) throw error;

      const { data: admins } = await supabase.from('user_profiles').select('id').in('role', ['CEO', 'ADMIN', 'OPERATOR']);
      await Promise.all((admins || []).map((a) => createNotification({
        userId: a.id,
        category: 'delivery_update',
        title: 'Proof of delivery submitted',
        message: `Trip ${tripRef} — delivery recorded at ${new Date(deliveredAt).toLocaleString()}.`,
        severity: 'success',
      })));

      toast({
        title: 'Proof uploaded',
        description: 'Delivery proof saved with timestamp.',
      });
      (e.target as HTMLFormElement).reset();
      setCapturedImage(null);
      setDocumentFile(null);
      setSignatureDataUrl(null);
      clearSignature();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background pb-20 md:pb-0">
      <Sidebar role={role} />
      <main className="flex-1 md:ml-60 p-4 md:p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-headline tracking-tighter">Delivery Proof</h1>
            <p className="text-muted-foreground">Upload confirmation documents and photos for completed trips.</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Submit New Proof</CardTitle>
              <CardDescription>Attach files to verify successful delivery</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="tripId">Trip Reference / ID</Label>
                  <Input id="tripId" name="tripId" placeholder="e.g. TRP-2024-001" required />
                </div>
                
                <div className="space-y-2">
                  <Label>Proof Document / Photo</Label>
                  
                  {/* Camera Preview */}
                  {showCamera && (
                    <div className="relative bg-black rounded-xl overflow-hidden" style={{ minHeight: '256px' }}>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-64 object-cover"
                        style={{ transform: 'scaleX(1)' }}
                      />
                      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={stopCamera}
                          className="bg-white/90 text-black"
                        >
                          <X className="size-4 mr-1" />
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={capturePhoto}
                          className="bg-white text-black hover:bg-gray-100 border-2 border-black"
                        >
                          <Camera className="size-4 mr-1" />
                          Capture
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* Captured Image Preview */}
                  {capturedImage && !showCamera && (
                    <div className="relative rounded-xl overflow-hidden border">
                      <img 
                        src={capturedImage} 
                        alt="Captured proof" 
                        className="w-full h-48 object-cover"
                      />
                      <div className="absolute bottom-2 right-2 flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={retakePhoto}
                          className="bg-white/90"
                        >
                          <RotateCcw className="size-4 mr-1" />
                          Retake
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={clearPhoto}
                        >
                          <X className="size-4 mr-1" />
                          Clear
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* File Upload / Camera Button */}
                  {!showCamera && !capturedImage && (
                    <div className="grid grid-cols-2 gap-4">
                      <div 
                        className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-6 text-center hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => document.getElementById('file-upload')?.click()}
                      >
                        <Upload className="size-6 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm font-medium">Upload File</p>
                        <p className="text-xs text-muted-foreground">PNG, JPG, PDF</p>
                        <Input 
                          type="file" 
                          className="hidden" 
                          id="file-upload" 
                          accept="image/*,.pdf"
                          onChange={(ev) => setDocumentFile(ev.target.files?.[0] || null)}
                        />
                      </div>
                      <div 
                        className="border-2 border-dashed border-primary/25 rounded-xl p-6 text-center hover:bg-primary/5 transition-colors cursor-pointer bg-primary/5"
                        onClick={startCamera}
                      >
                        <Camera className="size-6 mx-auto text-primary mb-2" />
                        <p className="text-sm font-medium text-primary">Take Photo</p>
                        <p className="text-xs text-muted-foreground">Use camera</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Hidden canvas for capturing */}
                  <canvas ref={canvasRef} className="hidden" />
                </div>

                <div className="space-y-2">
                  <Label>Signed document (optional)</Label>
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(ev) => setDocumentFile(ev.target.files?.[0] || null)}
                  />
                  {documentFile && (
                    <p className="text-xs text-muted-foreground">{documentFile.name}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <PenLine className="size-4" /> Customer signature
                  </Label>
                  {signatureDataUrl && !signing ? (
                    <div className="border rounded-lg p-2">
                      <img src={signatureDataUrl} alt="Signature" className="h-24 w-full object-contain" />
                      <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={startSign}>
                        Redraw
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <canvas
                        ref={signCanvasRef}
                        width={400}
                        height={120}
                        className="w-full border rounded-lg bg-white touch-none"
                        onMouseDown={() => { signDrawing.current = true; const c = signCanvasRef.current; const ctx = c?.getContext('2d'); if (ctx) { ctx.beginPath(); } }}
                        onMouseUp={() => { signDrawing.current = false; }}
                        onMouseLeave={() => { signDrawing.current = false; }}
                        onMouseMove={drawSign}
                        onTouchStart={() => { signDrawing.current = true; }}
                        onTouchEnd={() => { signDrawing.current = false; }}
                        onTouchMove={drawSign}
                      />
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={clearSignature}>Clear</Button>
                        <Button type="button" size="sm" onClick={saveSignature}>Save signature</Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Delivery notes (optional)</Label>
                  <Textarea id="notes" name="notes" placeholder="Condition, recipient name, etc." className="resize-none" rows={3} />
                </div>

                <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <CheckCircle2 className="size-4" />
                      Submit Proof
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Insurance Documents Section - For Drivers */}
          {role === 'DRIVER' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="size-5 text-emerald-500" />
                  Insurance Documents
                </CardTitle>
                <CardDescription>
                  {assignedVehicle ? (
                    <>View insurance documents for your assigned vehicle: <strong>{assignedVehicle.plate_number || assignedVehicle.name}</strong></>
                  ) : (
                    "Insurance documents for your assigned vehicle"
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingInsurance ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    <span className="ml-2 text-sm text-muted-foreground">Loading insurance documents...</span>
                  </div>
                ) : insuranceDocuments.length > 0 ? (
                  <div className="space-y-3">
                    {insuranceDocuments.map((doc) => (
                      <div 
                        key={doc.id} 
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                            <FileText className="size-5 text-emerald-600" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{doc.document_name || 'Insurance Document'}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="capitalize">{doc.insurance_type?.replace('_', ' ') || 'Motor Vehicle'}</span>
                              <span>•</span>
                              <span>{doc.insurance_company || 'Unknown Provider'}</span>
                              {doc.expiry_date && (
                                <>
                                  <span>•</span>
                                  <span className={new Date(doc.expiry_date) < new Date() ? 'text-red-500' : 'text-emerald-600'}>
                                    Expires: {new Date(doc.expiry_date).toLocaleDateString()}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleViewDocument(doc)}
                            className="gap-1"
                          >
                            <Eye className="size-4" />
                            View
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => window.open(doc.file_url, '_blank')}
                            className="gap-1"
                          >
                            <ExternalLink className="size-4" />
                            Open
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Shield className="size-12 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground">No insurance documents found</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {assignedVehicle 
                        ? "Contact your administrator to upload insurance documents for your vehicle."
                        : "No vehicle is currently assigned to you."
                      }
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Document View Dialog */}
          <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{selectedDoc?.document_name || 'Insurance Document'}</DialogTitle>
              </DialogHeader>
              {selectedDoc && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <Label className="text-muted-foreground">Insurance Type</Label>
                      <p className="font-medium capitalize">{selectedDoc.insurance_type?.replace('_', ' ') || 'Motor Vehicle'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Insurance Company</Label>
                      <p className="font-medium">{selectedDoc.insurance_company || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Policy Number</Label>
                      <p className="font-medium">{selectedDoc.policy_number || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Expiry Date</Label>
                      <p className={`font-medium ${selectedDoc.expiry_date && new Date(selectedDoc.expiry_date) < new Date() ? 'text-red-500' : ''}`}>
                        {selectedDoc.expiry_date ? new Date(selectedDoc.expiry_date).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Status</Label>
                      <Badge className={selectedDoc.status === 'active' ? 'bg-emerald-500' : 'bg-yellow-500'}>
                        {selectedDoc.status || 'Active'}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Uploaded</Label>
                      <p className="font-medium">{new Date(selectedDoc.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  
                  {selectedDoc.file_url && (
                    <div className="border rounded-lg overflow-hidden">
                      {selectedDoc.file_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                        <img 
                          src={selectedDoc.file_url} 
                          alt={selectedDoc.document_name} 
                          className="w-full max-h-[500px] object-contain"
                        />
                      ) : selectedDoc.file_url.match(/\.pdf$/i) ? (
                        <div className="space-y-4">
                          <iframe 
                            src={`${selectedDoc.file_url}#toolbar=1&navpanes=1`}
                            className="w-full h-[500px] border-0"
                            title={selectedDoc.document_name}
                          />
                          <div className="flex justify-center gap-2 p-4 border-t">
                            <Button 
                              variant="outline"
                              onClick={() => window.open(selectedDoc.file_url, '_blank')}
                            >
                              <ExternalLink className="size-4 mr-2" />
                              Open in New Tab
                            </Button>
                            <Button 
                              variant="default"
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = selectedDoc.file_url;
                                link.download = selectedDoc.document_name || 'document.pdf';
                                link.click();
                              }}
                            >
                              <FileText className="size-4 mr-2" />
                              Download PDF
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-8 text-center">
                          <FileText className="size-16 mx-auto text-muted-foreground mb-4" />
                          <p className="text-muted-foreground mb-4">Document Preview Not Available</p>
                          <Button 
                            onClick={() => window.open(selectedDoc.file_url, '_blank')}
                          >
                            <ExternalLink className="size-4 mr-2" />
                            Open Document
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </main>
      <BottomTabs role={role} />
    </div>
  );
}

