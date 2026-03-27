'use client';

import { useState, useRef, useCallback } from 'react';
import { StorageError } from '@/lib/storage';

export interface UploadedPhoto {
  url: string;
  base64: string;
  mimeType: string;
  fileName: string;
  sizeKB: number;
}

interface UploaderProps {
  onUploadComplete: (photo: UploadedPhoto) => void;
  onUploadError: (message: string) => void;
  isDisabled?: boolean;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_SIZE_MB = 20;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return `File type not supported. Please use JPEG, PNG, or WEBP.`;
  }
  if (file.size > MAX_SIZE_BYTES) {
    return `File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is ${MAX_SIZE_MB}MB.`;
  }
  return null;
}

export default function Uploader({
  onUploadComplete,
  onUploadError,
  isDisabled = false,
}: UploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    const error = validateFile(file);
    if (error) {
      onUploadError(error);
      return;
    }
    setIsUploading(true);
    setUploadProgress(10);
    try {
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);
      setUploadProgress(25);
      const base64 = await fileToBase64(file);
      setUploadProgress(50);
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      setUploadProgress(85);
      if (!response.ok) {
        const data = await response.json();
        throw new StorageError(data.error ?? 'Upload failed');
      }
      const { url } = await response.json();
      setUploadProgress(100);
      setUploadedFileName(file.name);
      onUploadComplete({
        url,
        base64,
        mimeType: file.type,
        fileName: file.name,
        sizeKB: Math.round(file.size / 1024),
      });
    } catch (err) {
      setPreview(null);
      setUploadedFileName(null);
      onUploadError(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      );
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [onUploadComplete, onUploadError]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!isDisabled) setIsDragging(true);
  }, [isDisabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (isDisabled) return;
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [isDisabled, processFile]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  }, [processFile]);

  const handleClick = useCallback(() => {
    if (!isDisabled && !isUploading) {
      fileInputRef.current?.click();
    }
  }, [isDisabled, isUploading]);

  const handleRemove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setPreview(null);
    setUploadedFileName(null);
    setUploadProgress(0);
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
        disabled={isDisabled}
      />
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative rounded-xl border-2 border-dashed transition-all
          ${isDisabled
            ? 'border-zinc-700 opacity-50 cursor-not-allowed'
            : isDragging
            ? 'border-violet-400 bg-violet-500/10 cursor-copy'
            : preview
            ? 'border-zinc-600 cursor-pointer'
            : 'border-zinc-600 hover:border-zinc-400 cursor-pointer'
          }
        `}
        style={{ minHeight: preview ? '280px' : '200px' }}
      >
        {preview ? (
          <>
            <img
              src={preview}
              alt="Uploaded couple photo"
              className="w-full h-full object-cover rounded-xl"
              style={{ minHeight: '280px', maxHeight: '400px' }}
            />
            <div className="
              absolute bottom-0 left-0 right-0
              bg-gradient-to-t from-black/80 to-transparent
              rounded-b-xl px-4 py-3
              flex items-center justify-between
            ">
              <div>
                <p className="text-white text-sm font-medium truncate max-w-[200px]">
                  {uploadedFileName}
                </p>
                <p className="text-zinc-400 text-xs mt-0.5">Tap to replace</p>
              </div>
              <button
                onClick={handleRemove}
                className="
                  bg-zinc-800/80 hover:bg-red-900/60 border border-zinc-600
                  text-zinc-300 hover:text-red-300
                  text-xs px-3 py-1.5 rounded-lg transition-all
                "
              >
                Remove
              </button>
            </div>
            {isUploading && (
              <div className="
                absolute inset-0 bg-black/60 rounded-xl
                flex flex-col items-center justify-center gap-3
              ">
                <div className="w-48 bg-zinc-700 rounded-full h-1.5">
                  <div
                    className="bg-violet-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-white text-sm">Uploading...</p>
              </div>
            )}
          </>
        ) : (
          <div className="
            absolute inset-0 flex flex-col items-center justify-center
            gap-4 px-6 text-center
          ">
            {isUploading ? (
              <>
                <div className="w-48 bg-zinc-700 rounded-full h-1.5">
                  <div
                    className="bg-violet-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-zinc-400 text-sm">Uploading your photo...</p>
              </>
            ) : (
              <>
                <div className="
                  w-14 h-14 rounded-full bg-zinc-800 border border-zinc-700
                  flex items-center justify-center
                ">
                  <svg
                    width="24" height="24" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor"
                    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                    className="text-zinc-400"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <div>
                  <p className="text-white text-sm font-medium">
                    {isDragging ? 'Drop your photo here' : 'Upload your couple photo'}
                  </p>
                  <p className="text-zinc-500 text-xs mt-1">
                    Drag and drop or tap to browse
                  </p>
                  <p className="text-zinc-600 text-xs mt-1">
                    JPEG, PNG or WEBP · Max {MAX_SIZE_MB}MB
                  </p>
                </div>
                <div className="
                  bg-zinc-800/60 rounded-lg px-4 py-3
                  text-left w-full max-w-xs
                ">
                  <p className="text-zinc-400 text-xs font-medium mb-1.5">
                    Tips for best results
                  </p>
                  {[
                    'Both faces clearly visible',
                    'Good lighting, not too dark',
                    'Looking toward the camera',
                  ].map((tip) => (
                    <div key={tip} className="flex items-start gap-2 mt-1">
                      <span className="text-violet-400 text-xs mt-0.5">✓</span>
                      <p className="text-zinc-500 text-xs">{tip}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}