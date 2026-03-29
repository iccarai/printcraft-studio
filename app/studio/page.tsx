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
    variantIds: [18052, 18053, 18054, 18055, 18056], // S, M, L, XL, 2XL (White)
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
    variantIds: [62259, 62260, 62261, 62262, 62265, 62270, 62275], // Black + Heather Grey S/M/L
    retailPrice: 5500,
    description: 'Three-panel fleece pullover hoodie',
    fitMode: 'contain',
  },
  {
    id: 'pillow',
    label: 'Pillow',
    emoji: '🛋️',
    blueprintId: 229,           // Spun Polyester Square Pillowcase
    printProviderId: 10,        // MWW On Demand
    variantIds: [41632, 41635, 41638], // 16"x16", 18"x18", 20"x20"
    retailPrice: 2800,
    description: 'Spun polyester square pillowcase — portrait printed on both sides',
    fitMode: 'contain',
  },
  {
    id: 'mug',
    label: 'Mug',
    emoji: '☕',
    blueprintId: 635,           // Accent Coffee Mug (11oz, 15oz)
    printProviderId: 99,        // Printify Choice
    variantIds: [72180, 72182, 72183, 72184, 105883, 105885], // 11oz + 15oz, Black/Navy/Pink
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
    variantIds: [82219, 82221, 82222], // 14"x11", 20"x16", 24"x18" horizontal
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
  const [publishedProductUrl, setPublishedProductUrl] = useState<string | null>(null);
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
          publishNow: false,
          fitMode: selectedProduct.fitMode,
          appliedOptions: designOptions,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Publish failed');
      }

      setPublishedProductUrl(data.productUrl);
      setStep('complete');
      addToast('success', `${selectedProduct.label} saved as draft in Printify!`);

    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : 'Failed to publish. Please try again.';
      addToast('error', message);
    } finally {
      setIsPublishing(false);
    }
  }, [processedDesign, designOptions, uploadedPhoto, selectedProduct, addToast]);

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
    setPublishedProductUrl(null);
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
            <div className="
              w-20 h-20 rounded-full bg-violet-600/20
              border border-violet-600/40
              flex items-center justify-center
            ">
              <svg width="32" height="32" viewBox="0 0 24 24"
                fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className="text-violet-400">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-medium text-white">
                Portrait saved as draft
              </h1>
              <p className="text-zinc-400 text-sm mt-2 max-w-sm">
                Your product has been saved as a draft in Printify.
                Review it there before publishing to your Etsy shop.
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              {publishedProductUrl && (
                <a
                  href={publishedProductUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="
                    w-full py-3 rounded-lg text-sm font-medium
                    bg-violet-600 hover:bg-violet-500 text-white
                    transition-all text-center
                  "
                >
                  Review in Printify →
                </a>
              )}
              <button
                onClick={handleReset}
                className="
                  w-full py-3 rounded-lg text-sm font-medium
                  border border-zinc-700 text-zinc-300
                  hover:border-zinc-500 hover:text-white
                  transition-all
                "
              >
                Create another portrait
              </button>
            </div>
            <div className="bg-zinc-800/60 rounded-xl p-4 text-left w-full max-w-sm">
              <p className="text-zinc-400 text-xs font-medium mb-3 uppercase tracking-wider">
                What's next
              </p>
              {[
                'Open Printify and review the draft product',
                'Check the portrait placement looks correct',
                'Confirm your variants and pricing',
                'Publish to your Etsy shop when ready',
              ].map((item, i) => (
                <div key={item} className="flex items-start gap-2 mb-2">
                  <span className="text-xs text-zinc-600 font-medium mt-0.5 w-4 flex-shrink-0">
                    {i + 1}.
                  </span>
                  <p className="text-zinc-400 text-xs">{item}</p>
                </div>
              ))}
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
