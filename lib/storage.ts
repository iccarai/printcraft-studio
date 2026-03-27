import { put, del, list, head } from '@vercel/blob';

export interface UploadResult {
  url: string;
  pathname: string;
  contentType: string;
  size: number;
}

export interface StoredFile {
  url: string;
  pathname: string;
  size: number;
  uploadedAt: Date;
}

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
] as const;

const MAX_FILE_SIZE = 20 * 1024 * 1024;

export type AllowedMimeType = typeof ALLOWED_TYPES[number];

export function validateFile(
  file: File | Blob,
  mimeType: string
): void {
  if (file.size > MAX_FILE_SIZE) {
    throw new StorageError(
      `File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds the 20MB limit`
    );
  }

  if (!ALLOWED_TYPES.includes(mimeType as AllowedMimeType)) {
    throw new StorageError(
      `File type ${mimeType} is not supported. Use JPEG, PNG, or WEBP`
    );
  }
}

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
  }
}

export class StorageService {
  static async uploadPhoto(
    file: File | Blob,
    mimeType: string,
    folder: 'uploads' | 'processed' | 'exports' = 'uploads'
  ): Promise<UploadResult> {
    validateFile(file, mimeType);

    const extension = mimeType.split('/')[1].replace('jpeg', 'jpg');
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const pathname = `${folder}/${timestamp}-${random}.${extension}`;

    try {
      const blob = await put(pathname, file, {
        access: 'public',
        contentType: mimeType,
        addRandomSuffix: false,
      });

      return {
        url: blob.url,
        pathname: blob.pathname,
        contentType: mimeType,
        size: file.size,
      };
    } catch (error) {
      throw new StorageError(
        `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  static async uploadProcessedDesign(
    base64Data: string,
    orderId: string
  ): Promise<UploadResult> {
    const binary = Buffer.from(base64Data, 'base64');
    const blob = new Blob([binary], { type: 'image/png' });
    const pathname = `processed/${orderId}-design.png`;

    try {
      const result = await put(pathname, blob, {
        access: 'public',
        contentType: 'image/png',
        addRandomSuffix: false,
      });

      return {
        url: result.url,
        pathname: result.pathname,
        contentType: 'image/png',
        size: binary.length,
      };
    } catch (error) {
      throw new StorageError(
        `Design upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  static async uploadExport(
    buffer: Buffer,
    orderId: string,
    format: 'png' | 'pdf' = 'png'
  ): Promise<UploadResult> {
    const mimeType = format === 'pdf' ? 'application/pdf' : 'image/png';
    const pathname = `exports/${orderId}-export.${format}`;
    const blob = new Blob([buffer], { type: mimeType });

    try {
      const result = await put(pathname, blob, {
        access: 'public',
        contentType: mimeType,
        addRandomSuffix: false,
      });

      return {
        url: result.url,
        pathname: result.pathname,
        contentType: mimeType,
        size: buffer.length,
      };
    } catch (error) {
      throw new StorageError(
        `Export upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  static async deleteFile(url: string): Promise<void> {
    try {
      await del(url);
    } catch (error) {
      console.warn(`[Storage] Failed to delete ${url}:`, error);
    }
  }

  static async listFiles(
    folder: 'uploads' | 'processed' | 'exports'
  ): Promise<StoredFile[]> {
    try {
      const { blobs } = await list({ prefix: `${folder}/` });

      return blobs.map((blob) => ({
        url: blob.url,
        pathname: blob.pathname,
        size: blob.size,
        uploadedAt: new Date(blob.uploadedAt),
      }));
    } catch (error) {
      throw new StorageError(
        `Failed to list files: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  static async fileExists(url: string): Promise<boolean> {
    try {
      await head(url);
      return true;
    } catch {
      return false;
    }
  }
}