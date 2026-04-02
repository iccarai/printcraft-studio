'use client';

import { useState, useCallback, useEffect } from 'react';
import Uploader, { type UploadedPhoto } from '@/components/Uploader';
import StyleSelector from '@/components/StyleSelector';
import Preview, {
  type PreviewStatus,
  type ProcessedDesign,
} from '@/components/Preview';
import type { DesignOptions } from '@/lib/ai';

type StudioStep = 'upload' | 'style' | 'preview' | 'complete';

// ─── Printify Product Catalogue ───────────────────────────────────────────────
interface PrintifyProduct {
  id: string;
  label: string;
  emoji: string;
  blueprintId: number;
  printProviderId: number;
  variantIds: number[];         // default variants to enable
  retailPrice: number;          // cents
  description: string;
  fitMode: 'contain' | 'fill';
}

// Approximate overlay of the print area within each Printify blueprint mockup image
const PRINT_AREA_OVERLAY: Record<string, { top: string; left: string; width: string; height: string }> = {
  tee:    { top: '22%', left: '27%', width: '46%', height: '38%' },
  hoodie: { top: '22%', left: '28%', width: '44%', height: '34%' },
  pillow: { top: '6%',  left: '6%',  width: '88%', height: '88%' },
  mug:    { top: '28%', left: '10%', width: '76%', height: '48%' },
  canvas: { top: '2%',  left: '2%',  width: '96%', height: '96%' },
};

const PRINTIFY_PRODUCTS: PrintifyProduct[] = [
  {
    id: 'tee',
    label: 'T-Shirt',
    emoji: '👕',
    blueprintId: 12,            // Unisex Jersey Short Sleeve Tee (Bella+Canvas 3001)
    printProviderId: 99,        // Printify Choice
    variantIds: [
      // Black (XS–4XL + 5XL)
      18099, 18100, 18101, 18102, 18103, 18104, 18105, 18106, 101666,
      // White (XS–4XL + 5XL)
      18539, 18540, 18541, 18542, 18543, 18544, 18545, 18546, 101776,
      // Navy (XS–4XL + 5XL)
      18395, 18396, 18397, 18398, 18399, 18400, 18401, 18402, 101747,
      // Dark Grey Heather (XS–4XL)
      18147, 18148, 18149, 18150, 18151, 18152, 18153, 18154,
      // Athletic Heather (XS–4XL)
      18075, 18076, 18077, 18078, 18079, 18080, 18081, 18082,
      // Soft Cream (XS–4XL)
      18459, 18460, 18461, 18462, 18463, 18464, 18465, 18466,
      // Baby Blue (XS–4XL)
      18083, 18084, 18085, 18086, 18087, 18088, 18089, 18090,
      // Pink (XS–4XL)
      18435, 18436, 18437, 18438, 18439, 18440, 18441, 18442,
      // Forest (XS–4XL)
      18179, 18180, 18181, 18182, 18183, 18184, 18185, 18186,
      // Canvas Red (XS–4XL)
      18115, 18116, 18117, 18118, 18119, 18120, 18121, 18122,
    ],
    retailPrice: 3500,
    description: 'Bella+Canvas 3001 unisex jersey tee',
    fitMode: 'contain',
  },
  {
    id: 'hoodie',
    label: 'Hoodie',
    emoji: '🧥',
    blueprintId: 439,           // Three-Panel Fleece Hoodie
    printProviderId: 3,         // Marco Fine Arts
    variantIds: [
      // Black (S–3XL)
      62259, 62260, 62261, 62262, 62263, 98952,
      // Heather Grey (S–3XL)
      62265, 62270, 62275, 62280, 62285, 98955,
      // Navy (S, M, XL–3XL — no L)
      62266, 62271, 62281, 62286, 98957,
      // White (M–3XL — no XS/S)
      68052, 68053, 68054, 68055, 98962,
    ],
    retailPrice: 5500,
    description: 'Three-panel fleece pullover hoodie',
    fitMode: 'contain',
  },
  {
    id: 'pillow',
    label: 'Pillow',
    emoji: '🛋️',
    blueprintId: 220,           // Spun Polyester Square Pillow — full pillow with insert
    printProviderId: 10,        // MWW On Demand
    variantIds: [41521, 41524, 41527, 41530], // 14"x14", 16"x16", 18"x18", 20"x20"
    description: 'Spun polyester square pillow — 100% polyester cover & insert, double-sided print, concealed zipper. 4 sizes.',
    retailPrice: 3400,
    fitMode: 'contain',
  },
  {
    id: 'mug',
    label: 'Mug',
    emoji: '☕',
    blueprintId: 635,           // Accent Coffee Mug (11oz, 15oz)
    printProviderId: 99,        // Printify Choice
    variantIds: [
      // 11oz: Black, Navy, Pink, Red, Light Blue, Orange, Purple, Yellow, Light Green
      72180, 72182, 72183, 72184, 105888, 108906, 108907, 108908, 113942,
      // 15oz: Black, Navy, Pink, Red, Light Blue, Orange, Purple, Yellow
      105883, 105885, 105886, 105887, 105889, 108910, 108911, 108912,
    ],
    retailPrice: 2200,
    description: 'Accent coffee mug — 11oz & 15oz',
    fitMode: 'fill',
  },
  {
    id: 'canvas',
    label: 'Canvas',
    emoji: '🖼️',
    blueprintId: 937,           // Matte Canvas, Stretched, 0.75" (Multi-Size)
    printProviderId: 105,       // Jondo
    variantIds: [
      // Horizontal (24)
      82218, 82219, 82220, 82221, 82222, 82223, 82224, 82225, 82226, 82227,
      95209, 95210, 95211, 102196, 102197, 102198, 102206, 102209,
      114699, 114700, 114701, 114705, 114707, 114709,
      // Vertical (24)
      82228, 82229, 82230, 82231, 82232, 82233, 82234, 82235, 82236, 82237,
      95212, 95213, 95214, 102199, 102200, 102201, 102207, 102210,
      114702, 114703, 114704, 114706, 114708, 114710,
      // Square (10)
      82238, 82239, 82240,
      102202, 102203, 102204, 102205, 102208, 102211, 102212,
    ],
    retailPrice: 4500,
    description: 'Matte stretched canvas, 0.75" depth',
    fitMode: 'contain',
  },
];

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback(
    (type: ToastMessage['type'], message: string) => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000);
    },
    []
  );

  return { toasts, addToast };
}

function StepIndicator({ step }: { step: StudioStep }) {
  const steps: { key: StudioStep; label: string }[] = [
    { key: 'upload', label: 'Upload' },
    { key: 'style', label: 'Style' },
    { key: 'preview', label: 'Preview' },
    { key: 'complete', label: 'Done' },
  ];

  const currentIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`
                w-8 h-8 rounded-full flex items-center justify-center
                text-xs font-medium transition-all
                ${i < currentIndex
                  ? 'bg-violet-600 text-white'
                  : i === currentIndex
                  ? 'bg-violet-600 text-white ring-4 ring-violet-600/20'
                  : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                }
              `}
            >
              {i < currentIndex ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="3"
                  strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            <span
              className={`
                text-xs transition-all
                ${i === currentIndex
                  ? 'text-violet-400'
                  : i < currentIndex
                  ? 'text-zinc-400'
                  : 'text-zinc-600'
                }
              `}
            >
              {s.label}
            </span>
          </div>

          {i < steps.length - 1 && (
            <div
              className={`
                w-16 h-px mx-2 mb-4 transition-all
                ${i < currentIndex ? 'bg-violet-600' : 'bg-zinc-700'}
              `}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default function StudioPage() {
  const [step, setStep] = useState<StudioStep>('upload');
  const [uploadedPhoto, setUploadedPhoto] = useState<UploadedPhoto | null>(null);
  const [designOptions, setDesignOptions] = useState<DesignOptions | null>(null);
  const [processedDesign, setProcessedDesign] = useState<ProcessedDesign | null>(null);
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>('idle');
  const [previewError, setPreviewError] = useState<string | undefined>();
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  // Set after Printify product is created — used to poll for Etsy URL
  const [publishedProductId, setPublishedProductId] = useState<string | null>(null);
  // Set once Printify has synced the listing to Etsy
  const [etsyListingUrl, setEtsyListingUrl] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>('canvas');
  const [blueprintImages, setBlueprintImages] = useState<Record<number, string>>({});
  const { toasts, addToast } = useToast();

  const selectedProduct = PRINTIFY_PRODUCTS.find((p) => p.id === selectedProductId)
    ?? PRINTIFY_PRODUCTS[4];

  useEffect(() => {
    if (step !== 'preview') return;
    const ids = PRINTIFY_PRODUCTS.map((p) => p.blueprintId).join(',');
    fetch(`/api/printify/product-images?ids=${ids}`)
      .then((r) => r.json())
      .then((data: Record<string, string>) => {
        const images: Record<number, string> = {};
        for (const [id, url] of Object.entries(data)) {
          images[Number(id)] = url;
        }
        setBlueprintImages(images);
      })
      .catch(() => {/* silently fall back to emoji */});
  }, [step]);

  // ── Etsy polling: called after product creation ──────────────────────────────
  const pollForEtsyUrl = useCallback(
    async (productId: string) => {
      const maxAttempts = 36; // 3 minutes at 5-second intervals
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        try {
          const res = await fetch(`/api/printify/status?productId=${productId}`);
          const data = (await res.json()) as { status: string; etsyListingUrl: string | null };
          if (data.etsyListingUrl) { setEtsyListingUrl(data.etsyListingUrl); return; }
        } catch { /* keep polling */ }
      }
      addToast('info', 'Your Etsy listing is still publishing — refresh in a minute.');
    },
    [addToast]
  );

    const handleUploadComplete = useCallback((photo: UploadedPhoto) => {
    setUploadedPhoto(photo);
    setStep('style');
  }, []);

  const handleUploadError = useCallback((message: string) => {
    addToast('error', message);
  }, [addToast]);

  const handleStyleSubmit = useCallback(async (options: DesignOptions) => {
    if (!uploadedPhoto) return;

    setDesignOptions(options);
    setStep('preview');
    setPreviewStatus('processing');
    setPreviewError(undefined);
    setProcessedDesign(null);

    try {
      const response = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: uploadedPhoto.base64,
          imageMime: uploadedPhoto.mimeType,
          options,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Processing failed');
      }

      setProcessedDesign({
        base64Image: data.base64Image,
        dataUrl: data.dataUrl,
        blobUrl: data.blobUrl,
        promptUsed: data.promptUsed,
      });

      setPreviewStatus('complete');
      addToast('success', 'Your portrait is ready!');

    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : 'Portrait generation failed. Please try again.';
      setPreviewError(message);
      setPreviewStatus('error');
      addToast('error', message);
    }
  }, [uploadedPhoto, addToast]);

  const handleApprove = useCallback(async () => {
    if (!processedDesign || !designOptions || !uploadedPhoto) return;

    setIsPublishing(true);

    try {
      const response = await fetch('/api/printify/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: `order_${Date.now()}`,
          blobUrl: processedDesign.blobUrl,
          blueprintId: selectedProduct.blueprintId,
          printProviderId: selectedProduct.printProviderId,
          variantIds: selectedProduct.variantIds,
          title: buildProductTitle(designOptions, selectedProduct.label),
          description: selectedProduct.description,
          retailPrice: selectedProduct.retailPrice,
          tags: ['couples gift', 'custom portrait', 'caricature', selectedProduct.id],
          publishNow: true,
          fitMode: selectedProduct.fitMode,
          appliedOptions: designOptions,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Publish failed');
      }

      setPublishedProductId(data.productId);
      setEtsyListingUrl(null);
      setStep('complete');
      pollForEtsyUrl(data.productId);

    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : 'Failed to publish. Please try again.';
      addToast('error', message);
    } finally {
      setIsPublishing(false);
    }
  }, [processedDesign, designOptions, uploadedPhoto, selectedProduct, pollForEtsyUrl, addToast]);

  const handleReject = useCallback(() => {
    setProcessedDesign(null);
    setPreviewStatus('idle');
    setPreviewError(undefined);
    if (uploadedPhoto) {
      setStep('style');
    } else {
      setStep('upload');
    }
  }, [uploadedPhoto]);

  const handleDownload = useCallback(async () => {
    if (!processedDesign) return;

    setIsDownloading(true);

    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: `export_${Date.now()}`,
          base64Image: processedDesign.base64Image,
          format: 'png',
          quality: 'print',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Download failed');
      }

      const link = document.createElement('a');
      link.href = data.downloadUrl;
      link.download = data.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      addToast('success', 'Download started!');

    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : 'Download failed. Please try again.';
      addToast('error', message);
    } finally {
      setIsDownloading(false);
    }
  }, [processedDesign, addToast]);

  const handleReset = useCallback(() => {
    setStep('upload');
    setUploadedPhoto(null);
    setDesignOptions(null);
    setProcessedDesign(null);
    setPreviewStatus('idle');
    setPreviewError(undefined);
    setIsPublishing(false);
    setIsDownloading(false);
    setPublishedProductId(null);
    setEtsyListingUrl(null);
    setSelectedProductId('canvas');
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24"
                fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </div>
            <span className="font-medium text-white">PrintCraft Studio</span>
          </div>
          {step !== 'upload' && (
            <button
              onClick={handleReset}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Start over
            </button>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <StepIndicator step={step} />

        {step === 'upload' && (
          <div className="flex flex-col gap-6">
            <div className="text-center">
              <h1 className="text-2xl font-medium text-white">
                Create your couple portrait
              </h1>
              <p className="text-zinc-400 text-sm mt-2">
                Upload a photo and we'll turn it into a custom caricature
                printed on your choice of product.
              </p>
            </div>
            <Uploader
              onUploadComplete={handleUploadComplete}
              onUploadError={handleUploadError}
            />
          </div>
        )}

        {step === 'style' && (
          <div className="flex flex-col gap-6">
            <div className="text-center">
              <h1 className="text-2xl font-medium text-white">
                Choose your style
              </h1>
              <p className="text-zinc-400 text-sm mt-2">
                Pick an art style and add personal details to make
                it truly unique.
              </p>
            </div>
            {uploadedPhoto && (
              <div className="flex items-center gap-3 bg-zinc-800/60 rounded-xl p-3">
                <img
                  src={uploadedPhoto.url}
                  alt="Your uploaded photo"
                  className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate">
                    {uploadedPhoto.fileName}
                  </p>
                  <p className="text-zinc-500 text-xs mt-0.5">
                    {uploadedPhoto.sizeKB}KB · Ready to process
                  </p>
                </div>
                <button
                  onClick={() => setStep('upload')}
                  className="ml-auto flex-shrink-0 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Change
                </button>
              </div>
            )}
            <StyleSelector
              hasPhoto={!!uploadedPhoto}
              onSubmit={handleStyleSubmit}
            />
          </div>
        )}

        {step === 'preview' && (
          <div className="flex flex-col gap-6">
            <div className="text-center">
              <h1 className="text-2xl font-medium text-white">
                {previewStatus === 'processing'
                  ? 'Creating your portrait...'
                  : previewStatus === 'complete'
                  ? 'Your portrait is ready'
                  : previewStatus === 'error'
                  ? 'Something went wrong'
                  : 'Preview'
                }
              </h1>
              {previewStatus === 'complete' && (
                <p className="text-zinc-400 text-sm mt-2">
                  Review your portrait below. Approve to save as a
                  Printify draft, or download the file directly.
                </p>
              )}
            </div>

            {previewStatus === 'complete' && (
              <div className="w-full">
                <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-3">
                  Print on
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {PRINTIFY_PRODUCTS.map((product) => {
                    const isSelected = selectedProductId === product.id;
                    const bgImage = blueprintImages[product.blueprintId];
                    const overlay = PRINT_AREA_OVERLAY[product.id];
                    return (
                      <button
                        key={product.id}
                        onClick={() => setSelectedProductId(product.id)}
                        className={`
                          relative rounded-xl overflow-hidden border transition-all
                          aspect-square
                          ${isSelected
                            ? 'border-violet-500 ring-2 ring-violet-500/40'
                            : 'border-zinc-700 hover:border-zinc-500'
                          }
                        `}
                      >
                        {/* Product background */}
                        {bgImage ? (
                          <img
                            src={bgImage}
                            alt={product.label}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                            <span className="text-2xl">{product.emoji}</span>
                          </div>
                        )}

                        {/* Customer design overlaid on print area */}
                        {processedDesign && overlay && (
                          <div
                            className="absolute pointer-events-none"
                            style={{ top: overlay.top, left: overlay.left, width: overlay.width, height: overlay.height }}
                          >
                            <img
                              src={processedDesign.blobUrl || processedDesign.dataUrl}
                              alt=""
                              className={`w-full h-full ${product.fitMode === 'contain' ? 'object-contain' : 'object-cover'}`}
                            />
                          </div>
                        )}

                        {/* Label bar */}
                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm py-1 px-1 text-center">
                          <p className="text-white text-xs font-medium leading-tight">{product.label}</p>
                          <p className={`text-xs leading-tight ${isSelected ? 'text-violet-300' : 'text-zinc-400'}`}>
                            ${(product.retailPrice / 100).toFixed(0)}
                          </p>
                        </div>

                        {/* Selected checkmark */}
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-violet-600 flex items-center justify-center">
                            <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                              <polyline points="2 6 5 9 10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <Preview
              status={previewStatus}
              originalPhoto={uploadedPhoto}
              processedDesign={processedDesign}
              designOptions={designOptions}
              errorMessage={previewError}
              onApprove={handleApprove}
              onReject={handleReject}
              onDownload={handleDownload}
              isPublishing={isPublishing}
              isDownloading={isDownloading}
            />
          </div>
        )}

        {step === 'complete' && (
          <div className="flex flex-col items-center gap-6 py-8 text-center">
            <div className="w-20 h-20 rounded-full bg-violet-600/20 border border-violet-600/40 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-400">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-medium text-white">Your portrait is live!</h1>
              <p className="text-zinc-400 text-sm mt-2 max-w-sm">
                Your custom listing has been published to Etsy. Buy it before your design expires.
              </p>
            </div>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              {etsyListingUrl ? (
                <a href={etsyListingUrl} target="_blank" rel="noopener noreferrer"
                  className="w-full py-3.5 rounded-lg text-sm font-semibold bg-[#F1641E] hover:bg-[#d9561a] text-white transition-all text-center flex items-center justify-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 7h-3V6a4 4 0 0 0-8 0v1H5a1 1 0 0 0-1 1l-1 12a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1L20 8a1 1 0 0 0-1-1zm-9-1a2 2 0 0 1 4 0v1h-4V6zm7.9 13H6.1L7 9h10l.9 10z"/>
                  </svg>
                  Buy on Etsy
                </a>
              ) : (
                <div className="w-full py-3.5 rounded-lg text-sm font-medium bg-zinc-800 border border-zinc-700 text-zinc-400 flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-zinc-600 border-t-violet-400 rounded-full animate-spin" />
                  Publishing to Etsy...
                </div>
              )}
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-amber-950/30 border border-amber-800/40">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400 flex-shrink-0">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                <p className="text-amber-300/80 text-xs text-left">
                  Your design is saved for{' '}
                  <span className="font-semibold text-amber-300">24 hours</span>
                  {' '}— buy now to lock it in before it expires.
                </p>
              </div>
              <button onClick={handleReset}
                className="w-full py-2.5 rounded-lg text-sm font-medium border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-all">
                Create another portrait
              </button>
            </div>
          </div>
        )}
      </main>

      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`
              px-4 py-3 rounded-xl text-sm font-medium
              shadow-lg border transition-all max-w-xs
              ${toast.type === 'success'
                ? 'bg-zinc-900 border-violet-600/40 text-white'
                : toast.type === 'error'
                ? 'bg-zinc-900 border-red-600/40 text-red-300'
                : 'bg-zinc-900 border-zinc-700 text-zinc-300'
              }
            `}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}

function buildProductTitle(options: DesignOptions, productLabel = 'Canvas'): string {
  const styleLabels: Record<string, string> = {
    caricature: 'Caricature',
    cartoon: 'Cartoon',
    sketch: 'Pencil Sketch',
    comic: 'Comic Art',
  };

  const style = styleLabels[options.artStyle] ?? 'Portrait';

  if (options.partnerName1 && options.partnerName2) {
    return `Custom Couple ${style} ${productLabel} — ${options.partnerName1} & ${options.partnerName2}`;
  }

  return `Custom Couple ${style} ${productLabel}`;
}
