import React, { useState, useRef, useEffect } from "react";
import { Camera, Upload, X, Check, RotateCcw, Image, AlertTriangle } from "lucide-react";

interface AvatarModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  role: "student" | "lecturer";
  userId: string;
  userName: string;
  onAvatarUpdated: () => void;
}

export default function AvatarModal({
  isOpen,
  onClose,
  token,
  role,
  userId,
  userName,
  onAvatarUpdated,
}: AvatarModalProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"camera" | "upload">("camera");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up camera stream on unmount or tab change
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
    } else {
      setCapturedImage(null);
      setError(null);
      if (activeTab === "camera") {
        startCamera();
      }
    }
  }, [isOpen, activeTab]);

  const startCamera = async () => {
    setError(null);
    setIsCapturing(true);
    setCapturedImage(null);
    try {
      if (stream) {
        stopCamera();
      }
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 400 },
          height: { ideal: 400 },
          facingMode: "user",
        },
        audio: false,
      });
      
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch((err) => {
          console.error("Error playing video:", err);
        });
      }
    } catch (err: any) {
      console.error("Camera access failed:", err);
      setError(
        "Could not access your device camera. Please verify camera permissions in your browser, or use the file upload fallback."
      );
      setIsCapturing(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsCapturing(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      if (context) {
        // Use a square cut from the video
        const size = Math.min(video.videoWidth, video.videoHeight);
        canvas.width = 300;
        canvas.height = 300;

        const sx = (video.videoWidth - size) / 2;
        const sy = (video.videoHeight - size) / 2;

        context.drawImage(video, sx, sy, size, size, 0, 0, 300, 300);
        
        try {
          const base64 = canvas.toDataURL("image/jpeg", 0.85);
          setCapturedImage(base64);
          stopCamera();
        } catch (err) {
          console.error("Failed to convert capture to base64:", err);
          setError("Failed to process captured photo.");
        }
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setError("Please select a valid image file.");
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        setError("Image size exceeds 2MB. Please upload a smaller image.");
        return;
      }

      setError(null);
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setCapturedImage(reader.result);
        }
      };
      reader.onerror = () => {
        setError("Failed to read image file.");
      };
      reader.readAsDataURL(file);
    }
  };

  const saveAvatar = async () => {
    if (!capturedImage) return;

    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/user/avatar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ avatar: capturedImage }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save profile avatar.");
      }

      // Save to localStorage for instant client-side reload
      localStorage.setItem(`futo_avatar_${userId}`, capturedImage);

      onAvatarUpdated();
      onClose();
    } catch (err: any) {
      console.error("Avatar save error:", err);
      setError(err.message || "An unexpected error occurred while saving your photo.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div 
        id="avatar-modal-container"
        className="relative max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-slate-900 dark:text-slate-100 space-y-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-950 dark:text-slate-50 font-display">
              FUTO Academic Identity Gate
            </h3>
            <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-0.5">
              Secure Photo Identity Portal
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-100 dark:border-slate-800">
          <button
            onClick={() => setActiveTab("camera")}
            className={`flex-1 pb-2 text-center text-xs font-bold uppercase tracking-wider transition-colors border-b-2 cursor-pointer ${
              activeTab === "camera"
                ? "border-slate-900 dark:border-slate-100 text-slate-900 dark:text-slate-100"
                : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            }`}
          >
            <span className="flex items-center justify-center gap-1.5">
              <Camera className="h-3.5 w-3.5" />
              Capture Camera
            </span>
          </button>
          <button
            onClick={() => setActiveTab("upload")}
            className={`flex-1 pb-2 text-center text-xs font-bold uppercase tracking-wider transition-colors border-b-2 cursor-pointer ${
              activeTab === "upload"
                ? "border-slate-900 dark:border-slate-100 text-slate-900 dark:text-slate-100"
                : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            }`}
          >
            <span className="flex items-center justify-center gap-1.5">
              <Upload className="h-3.5 w-3.5" />
              Upload Image
            </span>
          </button>
        </div>

        {/* Status Error Alert */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 text-xs flex gap-2 items-start">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Tab Panels */}
        <div className="flex flex-col items-center justify-center">
          {activeTab === "camera" && (
            <div className="w-full flex flex-col items-center">
              {capturedImage ? (
                /* Captured Preview State */
                <div className="relative w-64 h-64 border-2 border-slate-900 dark:border-slate-100 bg-slate-50 dark:bg-slate-950 flex items-center justify-center overflow-hidden">
                  <img
                    src={capturedImage}
                    alt="Captured Profile"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 bg-slate-900/80 text-white font-mono text-[8px] px-1.5 py-0.5 uppercase tracking-wider">
                    ID Preview
                  </div>
                </div>
              ) : (
                /* Active Stream Camera view */
                <div className="relative w-64 h-64 border border-slate-200 dark:border-slate-800 bg-slate-950 flex items-center justify-center overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                  {isCapturing && (
                    <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-green-500/80 text-white font-mono text-[8px] px-1.5 py-0.5 uppercase tracking-widest font-black animate-pulse">
                      <span className="h-1.5 w-1.5 bg-white rounded-full"></span> Lens Active
                    </div>
                  )}
                  {!stream && !error && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 text-xs space-y-2">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-400"></div>
                      <span className="font-mono text-[9px] uppercase tracking-wider">Initializing Camera...</span>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-4 flex gap-2 w-full justify-center">
                {!capturedImage ? (
                  <button
                    onClick={capturePhoto}
                    disabled={!stream}
                    className="px-4 py-2 bg-slate-900 dark:bg-slate-50 text-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-200 text-xs font-bold uppercase tracking-widest transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Camera className="h-4 w-4" />
                    Capture Photo
                  </button>
                ) : (
                  <button
                    onClick={startCamera}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold uppercase tracking-widest transition cursor-pointer flex items-center gap-1.5 border border-slate-200 dark:border-slate-700"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Retake
                  </button>
                )}
              </div>
            </div>
          )}

          {activeTab === "upload" && (
            <div className="w-full flex flex-col items-center">
              {capturedImage ? (
                <div className="relative w-64 h-64 border-2 border-slate-900 dark:border-slate-100 bg-slate-50 dark:bg-slate-950 flex items-center justify-center overflow-hidden">
                  <img
                    src={capturedImage}
                    alt="Uploaded Profile"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 bg-slate-900/80 text-white font-mono text-[8px] px-1.5 py-0.5 uppercase tracking-wider">
                    Uploaded Preview
                  </div>
                </div>
              ) : (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-64 h-64 border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50 hover:bg-slate-100 dark:hover:bg-slate-900/50 flex flex-col items-center justify-center text-center p-6 cursor-pointer transition"
                >
                  <Image className="h-8 w-8 text-slate-400 mb-2" />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Browse device files</span>
                  <span className="text-[10px] text-slate-400 mt-1">Supports PNG, JPG, JPEG (Max 2MB)</span>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="mt-4 flex gap-2 w-full justify-center">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold uppercase tracking-widest transition cursor-pointer flex items-center gap-1.5 border border-slate-200 dark:border-slate-700"
                >
                  <Upload className="h-4 w-4" />
                  Select File
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Hidden Canvas Helper */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Instructions Footer panel */}
        <div className="bg-slate-50 dark:bg-slate-950 p-3.5 border border-slate-150 dark:border-slate-850">
          <p className="text-[10px] font-mono text-slate-500 dark:text-slate-450 leading-relaxed uppercase">
            Logged In As: <span className="font-bold text-slate-850 dark:text-slate-150">{userName} ({role === "student" ? "STUDENT" : "LECTURER"})</span>
            <br />
            ID REF: <span className="font-bold text-slate-850 dark:text-slate-150">{userId}</span>
          </p>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 text-xs font-bold uppercase tracking-wider transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={saveAvatar}
            disabled={!capturedImage || isSaving}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white text-xs font-bold uppercase tracking-widest transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                Saving Photo...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Commit Identity
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
