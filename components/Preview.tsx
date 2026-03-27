'use client';

import { useState } from 'react';
import type { UploadedPhoto } from '@/components/Uploader';
import type { DesignOptions } from '@/lib/ai';

export type PreviewStatus =
  | 'idle'
  | 'processing'
  | 'complete'
  | 'error';

export interface ProcessedDesign {
  base64Image: string;
  dataUrl: string;
  blobUrl: string;
  promptUsed: string;
}

interface PreviewProps {
  status: PreviewStatus;
  originalPhoto: UploadedPhoto | null;
  processedDesign: ProcessedDesign | null;
  designOptions: DesignOptions | null;
  errorMessage?: string;
  onApprove: () => void;
  onReject: () => void;
  onDownload: () => void;
  isPublishing?: boolean;
  isDownloading?: boolean;
}

function formatOptions(options: DesignOptions): string {
  const parts: string[] = [];
  parts.push(options.artStyle.charAt(0).toUpperCase() + options.artStyle.slice(1));
  parts.push(options.orientation);
  if (options.partnerName1 && options.partnerName2) {
    parts.push(`${options.partnerName1} & ${options.partnerName2}`);
  }
  if (options.specialDate) parts.push(options.specialDate);
  return parts.join(' · ');
}

function ProcessingSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-12 px-6">
      <div className="relative w-20 h-20">
        <div className="
          absolute inset-0 rounded-full border-2 border-violet-500/30
          animate-ping
        " />
        <div className="
          relative w-20 h-20 rounded-full bg-zinc-800 border border-zinc-700
          flex items-center justify-center
        ">
          <svg
            width="36" height="36" viewBox="0 0 24 24"
            fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            className="text-violet-400"
          >
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            <path d="M15 5c1-1 3-1 3 1" />
            <path d="M9 5c-1-1-3-1-3 1" />
          </svg>
        </div>
      </div>
      <div className="text-center">
        <p className="text-white text-base font-medium">
          Creating your caricature
        </p>
        <p className="text-zinc-400 text-sm mt-1">
          This takes about 15–30 seconds
        </p>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-xs">
        {[
          'Analysing your photo...',
          'Applying art style...',
          'Adding personalisation...',
          'Finalising for print...',
        ].map((step, i) => (
          <div
            key={step}
            className="flex items-center gap-3"
            style={{ animationDelay: `${i * 0.8}s` }}
          >
            <div className="
              w-4 h-4 rounded-full bg-zinc-700 border border-zinc-600
              flex items-center justify-center flex-shrink-0
            ">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            </div>
            <p className="text-zinc-500 text-xs">{step}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Preview({
  status,
  originalPhoto,
  processedDesign,
  designOptions,
  errorMessage,
  onApprove,
  onReject,
  onDownload,
  isPublishing = false,
  isDownloading = false,
}: PreviewProps) {
  const [showOriginal, setShowOriginal] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  if (status === 'idle') {
    return (
      <div className="
        flex flex-col items-center justify-center gap-3
        py-16 px-6 text-center
        rounded-xl border border-dashed border-zinc-700
      ">
        <div className="
          w-14 h-14 rounded-full bg-zinc-800 border border-zinc-700
          flex items-center justify-center
        ">
          <svg
            width="24" height="24" viewBox="0 0 24 24"
            fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            className="text-zinc-600"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </div>
        <p className="text-zinc-500 text-sm">
          Your portrait preview will appear here
        </p>
      </div>
    );
  }

  if (status === 'processing') {
    return (
      <div className="rounded-xl border border-zinc-700 bg-zinc-900 overflow-hidden">
        <ProcessingSkeleton />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="
        rounded-xl border border-red-900/50 bg-red-950/20
        flex flex-col items-center gap-4 py-10 px-6 text-center
      ">
        <div className="
          w-14 h-14 rounded-full bg-red-950/40 border border-red-900/50
          flex items-center justify-center
        ">
          <svg
            width="24" height="24" viewBox="0 0 24 24"
            fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            className="text-red-400"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div>
          <p className="text-white text-sm font-medium">Processing failed</p>
          <p className="text-red-400 text-xs mt-1 max-w-xs leading-relaxed">
            {errorMessage ?? 'Something went wrong. Please try again with a clearer photo.'}
          </p>
        </div>
        <button
          onClick={onReject}
          className="
            text-xs text-zinc-400 hover:text-white
            border border-zinc-700 hover:border-zinc-500
            px-4 py-2 rounded-lg transition-all
          "
        >
          Try again
        </button>
      </div>
    );
  }

  if (status === 'complete' && processedDesign) {
    return (
      <div className="flex flex-col gap-4">
        {designOptions && (
          <div className="
            bg-zinc-800/60 rounded-lg px-3 py-2
            flex items-center justify-between
          ">
            <p className="text-zinc-400 text-xs">
              {formatOptions(designOptions)}
            </p>
            <button
              onClick={onReject}
              className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors"
            >
              Change
            </button>
          </div>
        )}

        {originalPhoto && (
          <div className="flex rounded-lg overflow-hidden border border-zinc-700 w-fit mx-auto">
            <button
              onClick={() => setShowOriginal(false)}
              className={`
                px-4 py-1.5 text-xs font-medium transition-all
                ${!showOriginal
                  ? 'bg-violet-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                }
              `}
            >
              Portrait
            </button>
            <button
              onClick={() => setShowOriginal(true)}
              className={`
                px-4 py-1.5 text-xs font-medium transition-all
                ${showOriginal
                  ? 'bg-violet-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                }
              `}
            >
              Original
            </button>
          </div>
        )}

        <div className="relative rounded-xl overflow-hidden bg-zinc-800">
          {!imageLoaded && (
            <div className="
              absolute inset-0 bg-zinc-800
              flex items-center justify-center
            ">
              <div className="w-8 h-8 border-2 border-zinc-600 border-t-violet-500 rounded-full animate-spin" />
            </div>
          )}
          <img
            src={
              showOriginal
                ? originalPhoto?.url
                : processedDesign.dataUrl
            }
            alt={
              showOriginal
                ? 'Your original photo'
                : 'Your custom caricature portrait'
            }
            onLoad={() => setImageLoaded(true)}
            className={`
              w-full object-contain transition-opacity duration-300
              ${imageLoaded ? 'opacity-100' : 'opacity-0'}
            `}
            style={{ maxHeight: '480px' }}
          />
          {!showOriginal && imageLoaded && (
            <div className="
              absolute top-3 left-3
              bg-black/60 backdrop-blur-sm
              text-white text-xs px-2.5 py-1 rounded-full
              border border-white/10
            ">
              AI portrait
            </div>
          )}
        </div>

        <p className="text-zinc-500 text-xs text-center">
          This design will be applied to your selected products
        </p>

        <div className="flex flex-col gap-2">
          <button
            onClick={onApprove}
            disabled={isPublishing}
            className={`
              w-full py-3 rounded-lg text-sm font-medium transition-all
              ${isPublishing
                ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                : 'bg-violet-600 hover:bg-violet-500 text-white'
              }
            `}
          >
            {isPublishing
              ? 'Sending to print...'
              : 'Approve and send to Printify'
            }
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onDownload}
              disabled={isDownloading}
              className={`
                py-2.5 rounded-lg text-sm font-medium border transition-all
                flex items-center justify-center gap-2
                ${isDownloading
                  ? 'border-zinc-700 text-zinc-500 cursor-not-allowed'
                  : 'border-zinc-600 text-zinc-300 hover:border-zinc-400 hover:text-white'
                }
              `}
            >
              <svg
                width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {isDownloading ? 'Downloading...' : 'Download'}
            </button>

            <button
              onClick={onReject}
              disabled={isPublishing}
              className="
                py-2.5 rounded-lg text-sm font-medium border
                border-zinc-600 text-zinc-300
                hover:border-zinc-400 hover:text-white
                transition-all
              "
            >
              Redo portrait
            </button>
          </div>
        </div>

        <div className="
          flex items-center justify-center gap-2
          text-zinc-600 text-xs
        ">
          <svg
            width="12" height="12" viewBox="0 0 24 24"
            fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>Your photo is never stored after processing</span>
        </div>
      </div>
    );
  }

  return null;
}