import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  constructor(private readonly config: ConfigService) {}

  async uploadBase64Image(base64: string, folder: string) {
    if (typeof base64 !== 'string' || !base64.startsWith('data:image/')) {
      return null;
    }

    this.configure();
    let result;
    try {
      result = await cloudinary.uploader.upload(base64, {
        folder,
        resource_type: 'image',
      });
    } catch (error) {
      throw this.toSafeCloudinaryError(error);
    }

    return { url: result.secure_url, publicId: result.public_id };
  }

  async deleteImage(publicId: string) {
    this.configure();
    let result;
    try {
      result = await cloudinary.uploader.destroy(publicId, {
        invalidate: true,
        resource_type: 'image',
      });
    } catch (error) {
      throw this.toSafeCloudinaryError(error);
    }

    if (result.result !== 'ok' && result.result !== 'not found') {
      throw new Error(`Cloudinary image deletion failed: ${result.result}`);
    }
  }

  private configure() {
    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret) {
      throw new InternalServerErrorException(
        'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
      );
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
  }

  private toSafeCloudinaryError(error: unknown): ServiceUnavailableException {
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: unknown }).message).toLowerCase()
        : '';
    if (message.includes('invalid api_key') || message.includes('invalid signature')) {
      return new ServiceUnavailableException(
        'Cloudinary refuse les identifiants configurés. Vérifiez CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY et CLOUDINARY_API_SECRET dans backend/.env, puis redémarrez le backend.',
      );
    }
    return new ServiceUnavailableException(
      'Le service Cloudinary est temporairement indisponible. Réessayez dans quelques instants.',
    );
  }
}
