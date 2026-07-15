/**
 * Provider-agnostic attachment storage contract.
 *
 * Phase 1 prepares the architecture for future support of comment attachments,
 * images and files (e.g. attaching annotated screenshots to review comments).
 * No concrete implementation ships yet; comment use-cases reserve a wiring
 * point for an AttachmentStore once a provider is chosen.
 */
export interface Attachment {
  id: string;
  filename: string;
  contentType: string;
  /** Size in bytes when known. */
  size?: number;
  /** URL to fetch the stored attachment, when applicable. */
  url?: string;
}

export interface UploadAttachmentParams {
  filename: string;
  contentType: string;
  content: Uint8Array;
}

export interface AttachmentStore {
  upload(params: UploadAttachmentParams): Promise<Attachment>;
  get(id: string): Promise<Attachment | null>;
  delete(id: string): Promise<void>;
}

/**
 * Default placeholder that fails fast. Replace with a real implementation
 * (Bitbucket/S3/etc.) when attachment support is implemented.
 */
export class UnsupportedAttachmentStore implements AttachmentStore {
  async upload(): Promise<Attachment> {
    throw new Error('Attachment support is not implemented yet.');
  }

  async get(): Promise<Attachment | null> {
    return null;
  }

  async delete(): Promise<void> {
    throw new Error('Attachment support is not implemented yet.');
  }
}
