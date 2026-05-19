import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import 'multer';
import * as path from 'path';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class MediaService {
    private readonly baseUrl: string;
    private readonly apiKey: string;
    private readonly subject: string;
    private readonly serverUrl: string;
    private readonly it4788Prefix = 'it4788';
    private readonly useCloudinary: boolean;

    constructor(private configService: ConfigService) {
        this.baseUrl = this.configService.get<string>('MEDIA_BASE_URL') || 'http://localhost:8000';
        this.apiKey = this.configService.get<string>('MEDIA_API_KEY') || 'default_key';
        this.subject = this.configService.get<string>('MEDIA_API_SUBJECT') || 'default_subject';
        this.serverUrl = this.configService.get<string>('SERVER_URL') || 'http://localhost:3000';

        const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME') || 'dxqd8pxuj';
        const cApiKey = this.configService.get<string>('CLOUDINARY_API_KEY') || '341819754229424';
        const cApiSecret =
            this.configService.get<string>('CLOUDINARY_API_SECRET') ||
            'FOpeVEsFJlGYoE7Z21NLreQydhc';
        this.useCloudinary = this.configService.get<string>('USE_CLOUDINARY') === 'true';

        if (this.useCloudinary && cloudName && cApiKey && cApiSecret) {
            cloudinary.config({
                cloud_name: cloudName,
                api_key: cApiKey,
                api_secret: cApiSecret,
            });
        }
    }

    private async uploadToCloudinary(file: Express.Multer.File): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            let resourceType: 'image' | 'video' | 'raw' | 'auto' = 'auto';
            if (file.mimetype) {
                if (file.mimetype.startsWith('video/')) {
                    resourceType = 'video';
                } else if (file.mimetype.startsWith('image/')) {
                    resourceType = 'image';
                }
            } else if (file.originalname) {
                const ext = path.extname(file.originalname).toLowerCase();
                if (['.mp4', '.mov', '.avi', '.mkv', '.webm', '.3gp'].includes(ext)) {
                    resourceType = 'video';
                } else if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(ext)) {
                    resourceType = 'image';
                }
            }

            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    resource_type: resourceType,
                    folder: 'mercari_media',
                },
                (error, result) => {
                    if (error) {
                        reject(new Error(`Cloudinary upload failed: ${error.message}`));
                    } else if (result && result.secure_url) {
                        resolve(result.secure_url);
                    } else {
                        reject(
                            new Error(
                                'Cloudinary upload failed: secure_url is missing in response',
                            ),
                        );
                    }
                },
            );

            uploadStream.end(file.buffer);
        });
    }

    async uploadFile(file: Express.Multer.File): Promise<string> {
        // if (this.useCloudinary) {
        //     return this.uploadToCloudinary(file);
        // }

        const formData = new FormData();

        // Fix: Use Uint8Array to wrap buffer for standard fetch Blob compatibility
        const blob = new Blob([new Uint8Array(file.buffer)], { type: file.mimetype });
        formData.append('file', blob, file.originalname);

        const response = await fetch(`${this.baseUrl}/v1/videos/upload`, {
            method: 'POST',
            headers: {
                'X-WHAM-Subject': this.subject,
                'X-WHAM-Api-Key': this.apiKey,
            },
            body: formData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
                `Failed to upload to media server: ${response.statusText} - ${errorText}`,
            );
        }

        const data = await response.json();
        const videoId = data.video_id || data.id;

        // Return the download URL pointing to our proxy
        return `${this.serverUrl}/${this.it4788Prefix}/videos/${videoId}/download`;
    }

    async getVideoResponse(videoId: string): Promise<Response> {
        const response = await fetch(`${this.baseUrl}/v1/videos/${videoId}/download`, {
            method: 'GET',
            headers: {
                'X-WHAM-Subject': this.subject,
                'X-WHAM-Api-Key': this.apiKey,
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch video from storage: ${response.statusText}`);
        }

        return response;
    }

    /**
     * Helper to convert direct storage URLs to proxied URLs for backward compatibility
     */
    getProxiedUrl(originalUrl: string): string {
        if (!originalUrl) {
            return originalUrl;
        }

        // If it's a Cloudinary URL, return as is immediately
        if (originalUrl.includes('cloudinary.com')) {
            return originalUrl;
        }

        // If it's already a proxied URL, return as is
        if (originalUrl.includes(`/${this.it4788Prefix}/videos/`)) {
            return originalUrl;
        }

        // If it's a direct storage URL, extract videoId and convert
        // Example: http://localhost:8000/v1/videos/vid_123/download
        const match = originalUrl.match(/\/v1\/videos\/([^/]+)\/download/);
        if (match && match[1]) {
            const videoId = match[1];
            return `${this.serverUrl}/${this.it4788Prefix}/videos/${videoId}/download`;
        }

        return originalUrl;
    }

    async generateAndUploadThumbnail(
        videoFile: Express.Multer.File,
        videoUrl?: string,
    ): Promise<string> {
        await Promise.resolve(); // Satisfies require-await ESLint rule

        if (videoUrl && videoUrl.includes('cloudinary.com')) {
            // Instantly generate the thumbnail URL using Cloudinary dynamic CDN transformations
            return videoUrl
                .replace('/video/upload/', '/video/upload/so_1/')
                .replace(/\.[^/.]+$/, '.jpg');
        }

        return videoUrl || '';
    }
}
