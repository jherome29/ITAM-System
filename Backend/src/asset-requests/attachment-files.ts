import { BadRequestException } from '@nestjs/common';

// Upload limits for return / incident attachments. Mirrored by the CHECK
// constraints in Database/schemas/010 and by the frontend picker.
export const MAX_ATTACHMENTS = 3;
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export interface UploadedAttachment {
  originalname: string;
  size: number;
  buffer: Buffer;
}

export interface CheckedAttachment {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  content: Buffer;
}

/**
 * Identifies the file from its leading bytes. The client-sent Content-Type and
 * extension are ignored — a renamed executable is rejected here no matter what
 * it claims to be (OWASP ASVS 12.2.1).
 */
export function detectMimeType(buf: Buffer): string | null {
  if (
    buf.length >= 3 &&
    buf[0] === 0xff &&
    buf[1] === 0xd8 &&
    buf[2] === 0xff
  ) {
    return 'image/jpeg';
  }
  if (
    buf.length >= 8 &&
    buf
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('latin1') === 'RIFF' &&
    buf.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (buf.length >= 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-') {
    return 'application/pdf';
  }
  return null;
}

/** Path-free, header-safe file name for storage and Content-Disposition. */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const cleaned = base
    .replace(/[^\w.\- ]/g, '_')
    .replace(/^\.+/, '')
    .trim();
  return (cleaned || 'attachment').slice(0, 120);
}

export function checkAttachments(
  files: UploadedAttachment[] | undefined,
): CheckedAttachment[] {
  if (files !== undefined && !Array.isArray(files)) {
    throw new BadRequestException('Invalid attachments payload.');
  }

  const list = files ?? [];
  if (list.length > MAX_ATTACHMENTS) {
    throw new BadRequestException(
      `At most ${MAX_ATTACHMENTS} attachments are allowed.`,
    );
  }
  return list.map((file) => {
    if (
      !file ||
      typeof file.originalname !== 'string' ||
      typeof file.size !== 'number' ||
      !Number.isFinite(file.size) ||
      !Buffer.isBuffer(file.buffer)
    ) {
      throw new BadRequestException('Invalid attachment data.');
    }

    if (file.size <= 0 || file.size > MAX_ATTACHMENT_BYTES) {
      throw new BadRequestException(
        `"${sanitizeFileName(file.originalname)}" must be between 1 byte and 5 MB.`,
      );
    }
    const mimeType = detectMimeType(file.buffer);
    if (!mimeType) {
      throw new BadRequestException(
        `"${sanitizeFileName(file.originalname)}" is not a JPG, PNG, WEBP or PDF file.`,
      );
    }
    return {
      fileName: sanitizeFileName(file.originalname),
      mimeType,
      sizeBytes: file.size,
      content: file.buffer,
    };
  });
}
