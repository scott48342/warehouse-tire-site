"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { BRAND } from "@/lib/brand";

type Step = "photos" | "vehicle" | "products" | "details" | "review";

interface ImageUpload {
  file: File;
  preview: string;
  url?: string;
  uploading?: boolean;
  error?: string;
  angle?: "front" | "side" | "rear" | "interior" | "wheel_detail" | "other";
  isPrimary?: boolean;
}

interface FormData {
  // Vehicle
  vehicleYear: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleTrim: string;
  vehicleType: "truck" | "suv" | "jeep" | "car" | "";
  
  // Build
  liftType: "stock" | "leveled" | "lifted" | "";
  liftInches: string;
  liftBrand: string;
  stance: "flush" | "poke" | "tucked" | "aggressive" | "";
  
  // Wheels
  wheelBrand: string;
  wheelModel: string;
  wheelDiameter: string;
  wheelWidth: string;
  wheelOffset: string;
  wheelFinish: string;
  
  // Tires
  tireBrand: string;
  tireModel: string;
  tireSize: string;
  
  // Notes
  buildNotes: string;
  instagramHandle: string;
  customerName: string;
  customerEmail: string;
  
  // Consent
  consentGallery: boolean;
  consentMarketing: boolean;
}

const INITIAL_FORM: FormData = {
  vehicleYear: "",
  vehicleMake: "",
  vehicleModel: "",
  vehicleTrim: "",
  vehicleType: "",
  liftType: "",
  liftInches: "",
  liftBrand: "",
  stance: "",
  wheelBrand: "",
  wheelModel: "",
  wheelDiameter: "",
  wheelWidth: "",
  wheelOffset: "",
  wheelFinish: "",
  tireBrand: "",
  tireModel: "",
  tireSize: "",
  buildNotes: "",
  instagramHandle: "",
  customerName: "",
  customerEmail: "",
  consentGallery: false,
  consentMarketing: false,
};

const STEPS: { key: Step; label: string; emoji: string }[] = [
  { key: "photos", label: "Photos", emoji: "📸" },
  { key: "vehicle", label: "Vehicle", emoji: "🚗" },
  { key: "products", label: "Products", emoji: "🛞" },
  { key: "details", label: "Details", emoji: "✍️" },
  { key: "review", label: "Review", emoji: "✅" },
];

export default function AddYourBuildClient() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("photos");
  const [images, setImages] = useState<ImageUpload[]>([]);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prefilled, setPrefilled] = useState(false);

  // Prefill form from URL params (from order confirmation page)
  useEffect(() => {
    if (prefilled) return;
    
    const updates: Partial<FormData> = {};
    
    // Vehicle info
    if (searchParams.get("year")) updates.vehicleYear = searchParams.get("year") || "";
    if (searchParams.get("make")) updates.vehicleMake = searchParams.get("make") || "";
    if (searchParams.get("model")) updates.vehicleModel = searchParams.get("model") || "";
    if (searchParams.get("trim")) updates.vehicleTrim = searchParams.get("trim") || "";
    
    // Wheel info
    if (searchParams.get("wheelBrand")) updates.wheelBrand = searchParams.get("wheelBrand") || "";
    if (searchParams.get("wheelModel")) updates.wheelModel = searchParams.get("wheelModel") || "";
    if (searchParams.get("wheelDiameter")) updates.wheelDiameter = searchParams.get("wheelDiameter") || "";
    
    // Tire info
    if (searchParams.get("tireBrand")) updates.tireBrand = searchParams.get("tireBrand") || "";
    if (searchParams.get("tireModel")) updates.tireModel = searchParams.get("tireModel") || "";
    if (searchParams.get("tireSize")) updates.tireSize = searchParams.get("tireSize") || "";
    
    // If we have any prefill data, apply it
    if (Object.keys(updates).length > 0) {
      setForm((prev) => ({ ...prev, ...updates }));
      setPrefilled(true);
    }
  }, [searchParams, prefilled]);

  // Handle file selection
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (images.length + files.length > 5) {
      setError("Maximum 5 images allowed");
      return;
    }
    
    const newImages: ImageUpload[] = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      isPrimary: images.length === 0 && files.indexOf(file) === 0,
    }));
    
    setImages((prev) => [...prev, ...newImages]);
    setError(null);
  }, [images.length]);

  // Remove image
  const removeImage = useCallback((index: number) => {
    setImages((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      // Ensure one is primary
      if (updated.length > 0 && !updated.some(img => img.isPrimary)) {
        updated[0].isPrimary = true;
      }
      return updated;
    });
  }, []);

  // Set primary image
  const setPrimaryImage = useCallback((index: number) => {
    setImages((prev) => prev.map((img, i) => ({
      ...img,
      isPrimary: i === index,
    })));
  }, []);

  // Set image angle
  const setImageAngle = useCallback((index: number, angle: ImageUpload["angle"]) => {
    setImages((prev) => prev.map((img, i) => 
      i === index ? { ...img, angle } : img
    ));
  }, []);

  // Upload images
  const uploadImages = async (): Promise<boolean> => {
    const toUpload = images.filter((img) => !img.url);
    
    for (const img of toUpload) {
      const index = images.indexOf(img);
      setImages((prev) => prev.map((x, i) => 
        i === index ? { ...x, uploading: true } : x
      ));
      
      try {
        const formData = new FormData();
        formData.append("file", img.file);
        
        const res = await fetch("/api/builds/upload", {
          method: "POST",
          body: formData,
        });
        
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Upload failed");
        }
        
        const data = await res.json();
        
        setImages((prev) => prev.map((x, i) => 
          i === index ? { ...x, url: data.url, uploading: false } : x
        ));
      } catch (err) {
        setImages((prev) => prev.map((x, i) => 
          i === index ? { ...x, error: (err as Error).message, uploading: false } : x
        ));
        return false;
      }
    }
    
    return true;
  };

  // Submit form
  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    
    try {
      // Upload any remaining images
      const uploadSuccess = await uploadImages();
      if (!uploadSuccess) {
        throw new Error("Failed to upload all images");
      }
      
      // Get latest images with URLs
      const currentImages = images.filter((img) => img.url);
      if (currentImages.length === 0) {
        throw new Error("No images uploaded");
      }
      
      // Get orderId from URL if available (from order confirmation)
      const orderId = searchParams.get("orderId") || undefined;
      
      const payload = {
        customerEmail: form.customerEmail || undefined,
        customerName: form.customerName || undefined,
        orderId,
        vehicleYear: form.vehicleYear ? parseInt(form.vehicleYear) : undefined,
        vehicleMake: form.vehicleMake,
        vehicleModel: form.vehicleModel,
        vehicleTrim: form.vehicleTrim || undefined,
        vehicleType: form.vehicleType || undefined,
        liftType: form.liftType || undefined,
        liftInches: form.liftInches ? parseFloat(form.liftInches) : undefined,
        liftBrand: form.liftBrand || undefined,
        stance: form.stance || undefined,
        wheelBrand: form.wheelBrand || undefined,
        wheelModel: form.wheelModel || undefined,
        wheelDiameter: form.wheelDiameter || undefined,
        wheelWidth: form.wheelWidth || undefined,
        wheelOffset: form.wheelOffset || undefined,
        wheelFinish: form.wheelFinish || undefined,
        tireBrand: form.tireBrand || undefined,
        tireModel: form.tireModel || undefined,
        tireSize: form.tireSize || undefined,
        buildNotes: form.buildNotes || undefined,
        instagramHandle: form.instagramHandle || undefined,
        images: currentImages.map((img) => ({
          url: img.url!,
          angle: img.angle,
          isPrimary: img.isPrimary,
        })),
        consentGallery: form.consentGallery,
        consentMarketing: form.consentMarketing,
      };
      
      const res = await fetch("/api/builds/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Submission failed");
      }
      
      setSubmissionId(data.submissionId);
      setSubmitted(true);
      
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // Update form field
  const updateForm = (field: keyof FormData, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // Navigate steps
  const canProceed = (): boolean => {
    switch (step) {
      case "photos":
        return images.length >= 1;
      case "vehicle":
        return !!form.vehicleMake && !!form.vehicleModel;
      case "products":
        return true; // Optional
      case "details":
        return form.consentGallery;
      case "review":
        return true;
      default:
        return false;
    }
  };

  const nextStep = () => {
    const currentIndex = STEPS.findIndex((s) => s.key === step);
    if (currentIndex < STEPS.length - 1) {
      setStep(STEPS[currentIndex + 1].key);
    }
  };

  const prevStep = () => {
    const currentIndex = STEPS.findIndex((s) => s.key === step);
    if (currentIndex > 0) {
      setStep(STEPS[currentIndex - 1].key);
    }
  };

  // Success screen
  if (submitted) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
        <div className="mx-auto max-w-2xl px-4 py-16">
          <div className="text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-3xl font-extrabold text-neutral-900 mb-4">
              Build Submitted!
            </h1>
            <p className="text-neutral-600 mb-8">
              Thanks for sharing your build! Our team will review it shortly and add it to our gallery.
            </p>
            {submissionId && (
              <p className="text-sm text-neutral-500 mb-8">
                Reference: {submissionId}
              </p>
            )}
            <Link
              href="/"
              className="inline-block rounded-xl bg-neutral-900 px-6 py-3 text-sm font-bold text-white hover:bg-neutral-800"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-neutral-900 mb-2">
            Add Your Build
          </h1>
          <p className="text-neutral-600">
            Show off your ride and inspire other enthusiasts
          </p>
        </div>

        {/* Progress */}
        <div className="flex justify-between mb-8">
          {STEPS.map((s, i) => {
            const currentIndex = STEPS.findIndex((x) => x.key === step);
            const isActive = s.key === step;
            const isComplete = i < currentIndex;
            
            return (
              <button
                key={s.key}
                onClick={() => i <= currentIndex && setStep(s.key)}
                disabled={i > currentIndex}
                className={`flex flex-col items-center gap-1 ${
                  isActive 
                    ? "text-neutral-900" 
                    : isComplete 
                      ? "text-green-600 cursor-pointer" 
                      : "text-neutral-400"
                }`}
              >
                <span className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                  isActive 
                    ? "bg-neutral-900 text-white" 
                    : isComplete 
                      ? "bg-green-100 text-green-600" 
                      : "bg-neutral-200"
                }`}>
                  {isComplete ? "✓" : s.emoji}
                </span>
                <span className="text-xs font-medium hidden sm:block">{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Step Content */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
          {/* STEP 1: Photos */}
          {step === "photos" && (
            <div>
              <h2 className="text-xl font-bold text-neutral-900 mb-2">
                Upload Your Photos
              </h2>
              <p className="text-sm text-neutral-600 mb-6">
                Add 1-5 photos of your build. High-quality exterior shots work best!
              </p>
              
              {/* Upload Area */}
              <label className="block border-2 border-dashed border-neutral-300 rounded-xl p-8 text-center hover:border-neutral-400 cursor-pointer transition-colors mb-6">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={images.length >= 5}
                />
                <div className="text-4xl mb-2">📸</div>
                <div className="text-sm font-medium text-neutral-700">
                  Click to upload or drag photos here
                </div>
                <div className="text-xs text-neutral-500 mt-1">
                  JPEG, PNG, WebP up to 10MB ({images.length}/5)
                </div>
              </label>
              
              {/* Image Previews */}
              {images.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {images.map((img, i) => (
                    <div key={i} className="relative group">
                      <div className="aspect-[4/3] relative rounded-xl overflow-hidden border border-neutral-200">
                        <Image
                          src={img.preview}
                          alt={`Upload ${i + 1}`}
                          fill
                          className="object-cover"
                        />
                        {img.uploading && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                        {img.isPrimary && (
                          <div className="absolute top-2 left-2 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                            PRIMARY
                          </div>
                        )}
                      </div>
                      
                      {/* Controls */}
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!img.isPrimary && (
                          <button
                            onClick={() => setPrimaryImage(i)}
                            className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center text-xs hover:bg-white"
                            title="Set as primary"
                          >
                            ⭐
                          </button>
                        )}
                        <button
                          onClick={() => removeImage(i)}
                          className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center text-xs hover:bg-red-100"
                          title="Remove"
                        >
                          ✕
                        </button>
                      </div>
                      
                      {/* Angle selector */}
                      <select
                        value={img.angle || "other"}
                        onChange={(e) => setImageAngle(i, e.target.value as ImageUpload["angle"])}
                        className="mt-2 w-full text-xs rounded-lg border border-neutral-200 px-2 py-1"
                      >
                        <option value="front">Front view</option>
                        <option value="side">Side view</option>
                        <option value="rear">Rear view</option>
                        <option value="wheel_detail">Wheel detail</option>
                        <option value="interior">Interior</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Vehicle */}
          {step === "vehicle" && (
            <div>
              <h2 className="text-xl font-bold text-neutral-900 mb-2">
                Your Vehicle
              </h2>
              <p className="text-sm text-neutral-600 mb-6">
                Tell us about your ride
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Year</label>
                  <input
                    type="number"
                    value={form.vehicleYear}
                    onChange={(e) => updateForm("vehicleYear", e.target.value)}
                    placeholder="2024"
                    className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Make *</label>
                  <input
                    type="text"
                    value={form.vehicleMake}
                    onChange={(e) => updateForm("vehicleMake", e.target.value)}
                    placeholder="Ford"
                    className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Model *</label>
                  <input
                    type="text"
                    value={form.vehicleModel}
                    onChange={(e) => updateForm("vehicleModel", e.target.value)}
                    placeholder="F-150"
                    className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Trim</label>
                  <input
                    type="text"
                    value={form.vehicleTrim}
                    onChange={(e) => updateForm("vehicleTrim", e.target.value)}
                    placeholder="Lariat"
                    className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Vehicle Type</label>
                  <div className="flex gap-2">
                    {(["truck", "suv", "jeep", "car"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => updateForm("vehicleType", type)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium capitalize ${
                          form.vehicleType === type
                            ? "bg-neutral-900 text-white"
                            : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Products */}
          {step === "products" && (
            <div>
              <h2 className="text-xl font-bold text-neutral-900 mb-2">
                Wheels & Tires
              </h2>
              <p className="text-sm text-neutral-600 mb-6">
                What&apos;s rolling on your build?
              </p>
              
              {/* Build Type */}
              <div className="mb-6">
                <label className="block text-xs font-medium text-neutral-700 mb-2">Build Type</label>
                <div className="flex gap-2">
                  {(["stock", "leveled", "lifted"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => updateForm("liftType", type)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium capitalize ${
                        form.liftType === type
                          ? "bg-amber-500 text-white"
                          : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              
              {(form.liftType === "leveled" || form.liftType === "lifted") && (
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Lift Height</label>
                    <input
                      type="text"
                      value={form.liftInches}
                      onChange={(e) => updateForm("liftInches", e.target.value)}
                      placeholder='e.g., 4"'
                      className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Lift Brand</label>
                    <input
                      type="text"
                      value={form.liftBrand}
                      onChange={(e) => updateForm("liftBrand", e.target.value)}
                      placeholder="Rough Country"
                      className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              )}
              
              {/* Wheels */}
              <div className="border-t border-neutral-200 pt-6 mb-6">
                <h3 className="text-sm font-bold text-neutral-900 mb-4">🛞 Wheels</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Brand</label>
                    <input
                      type="text"
                      value={form.wheelBrand}
                      onChange={(e) => updateForm("wheelBrand", e.target.value)}
                      placeholder="Fuel"
                      className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Model</label>
                    <input
                      type="text"
                      value={form.wheelModel}
                      onChange={(e) => updateForm("wheelModel", e.target.value)}
                      placeholder="Rebel"
                      className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Size</label>
                    <input
                      type="text"
                      value={form.wheelDiameter}
                      onChange={(e) => updateForm("wheelDiameter", e.target.value)}
                      placeholder='20"'
                      className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Finish</label>
                    <input
                      type="text"
                      value={form.wheelFinish}
                      onChange={(e) => updateForm("wheelFinish", e.target.value)}
                      placeholder="Matte Black"
                      className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>
              
              {/* Tires */}
              <div className="border-t border-neutral-200 pt-6">
                <h3 className="text-sm font-bold text-neutral-900 mb-4">🔘 Tires</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Brand</label>
                    <input
                      type="text"
                      value={form.tireBrand}
                      onChange={(e) => updateForm("tireBrand", e.target.value)}
                      placeholder="Nitto"
                      className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Model</label>
                    <input
                      type="text"
                      value={form.tireModel}
                      onChange={(e) => updateForm("tireModel", e.target.value)}
                      placeholder="Ridge Grappler"
                      className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Size</label>
                    <input
                      type="text"
                      value={form.tireSize}
                      onChange={(e) => updateForm("tireSize", e.target.value)}
                      placeholder="35x12.50R20"
                      className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Details */}
          {step === "details" && (
            <div>
              <h2 className="text-xl font-bold text-neutral-900 mb-2">
                Final Details
              </h2>
              <p className="text-sm text-neutral-600 mb-6">
                Almost done! Add any extra info
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Build Notes</label>
                  <textarea
                    value={form.buildNotes}
                    onChange={(e) => updateForm("buildNotes", e.target.value)}
                    placeholder="Tell us about your build..."
                    rows={4}
                    className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm resize-none"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Your Name</label>
                    <input
                      type="text"
                      value={form.customerName}
                      onChange={(e) => updateForm("customerName", e.target.value)}
                      placeholder="John"
                      className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Instagram</label>
                    <input
                      type="text"
                      value={form.instagramHandle}
                      onChange={(e) => updateForm("instagramHandle", e.target.value)}
                      placeholder="@yourbuild"
                      className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Email (optional)</label>
                  <input
                    type="email"
                    value={form.customerEmail}
                    onChange={(e) => updateForm("customerEmail", e.target.value)}
                    placeholder="you@email.com"
                    className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                  />
                  <p className="text-xs text-neutral-500 mt-1">We&apos;ll notify you when your build is featured</p>
                </div>
                
                <div className="border-t border-neutral-200 pt-4 space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.consentGallery}
                      onChange={(e) => updateForm("consentGallery", e.target.checked)}
                      className="mt-0.5 rounded border-neutral-300"
                    />
                    <span className="text-sm text-neutral-700">
                      <span className="font-medium">I agree</span> to let {BRAND.name} use my photos in the build gallery and on product pages *
                    </span>
                  </label>
                  
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.consentMarketing}
                      onChange={(e) => updateForm("consentMarketing", e.target.checked)}
                      className="mt-0.5 rounded border-neutral-300"
                    />
                    <span className="text-sm text-neutral-700">
                      I&apos;m okay with my build being featured on social media
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Review */}
          {step === "review" && (
            <div>
              <h2 className="text-xl font-bold text-neutral-900 mb-2">
                Review Your Submission
              </h2>
              <p className="text-sm text-neutral-600 mb-6">
                Make sure everything looks good!
              </p>
              
              {/* Preview */}
              <div className="space-y-6">
                {/* Photos */}
                <div>
                  <h3 className="text-sm font-bold text-neutral-700 mb-2">📸 Photos ({images.length})</h3>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {images.map((img, i) => (
                      <div key={i} className="relative flex-shrink-0 w-24 h-20 rounded-lg overflow-hidden">
                        <Image src={img.preview} alt="" fill className="object-cover" />
                        {img.isPrimary && (
                          <div className="absolute bottom-1 left-1 bg-amber-500 text-[8px] text-white px-1 rounded">PRIMARY</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Vehicle */}
                <div className="border-t border-neutral-200 pt-4">
                  <h3 className="text-sm font-bold text-neutral-700 mb-2">🚗 Vehicle</h3>
                  <p className="text-sm text-neutral-900">
                    {[form.vehicleYear, form.vehicleMake, form.vehicleModel, form.vehicleTrim].filter(Boolean).join(" ")}
                  </p>
                  {form.liftType && form.liftType !== "stock" && (
                    <p className="text-sm text-amber-600 mt-1">
                      {form.liftType} {form.liftInches && `(${form.liftInches}")`} {form.liftBrand && `by ${form.liftBrand}`}
                    </p>
                  )}
                </div>
                
                {/* Wheels & Tires */}
                {(form.wheelBrand || form.tireBrand) && (
                  <div className="border-t border-neutral-200 pt-4">
                    <h3 className="text-sm font-bold text-neutral-700 mb-2">🛞 Setup</h3>
                    {form.wheelBrand && (
                      <p className="text-sm text-neutral-900">
                        Wheels: {form.wheelBrand} {form.wheelModel} {form.wheelDiameter && `${form.wheelDiameter}"`}
                      </p>
                    )}
                    {form.tireBrand && (
                      <p className="text-sm text-neutral-900 mt-1">
                        Tires: {form.tireBrand} {form.tireModel} {form.tireSize}
                      </p>
                    )}
                  </div>
                )}
                
                {/* Notes */}
                {form.buildNotes && (
                  <div className="border-t border-neutral-200 pt-4">
                    <h3 className="text-sm font-bold text-neutral-700 mb-2">✍️ Notes</h3>
                    <p className="text-sm text-neutral-600">{form.buildNotes}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          {step !== "photos" ? (
            <button
              onClick={prevStep}
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-neutral-700 hover:bg-neutral-100"
            >
              ← Back
            </button>
          ) : (
            <div />
          )}
          
          {step !== "review" ? (
            <button
              onClick={nextStep}
              disabled={!canProceed()}
              className="px-6 py-2.5 rounded-xl text-sm font-bold bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting || !form.consentGallery}
              className="px-6 py-2.5 rounded-xl text-sm font-bold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>Submit Build 🚀</>
              )}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
