import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';
import * as ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

const ffmpegFn = typeof ffmpeg === 'function' ? ffmpeg : (ffmpeg as any).default;

if (ffmpegPath) {
    if (typeof ffmpeg.setFfmpegPath === 'function') {
        ffmpeg.setFfmpegPath(ffmpegPath);
    } else if (ffmpegFn && typeof ffmpegFn.setFfmpegPath === 'function') {
        ffmpegFn.setFfmpegPath(ffmpegPath);
    }
}

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

        const data = (await response.json()) as { video_id?: string; id?: string };
        const videoId = data.video_id || data.id;

        // Return the stream URL pointing to our proxy
        return `${this.serverUrl}/${this.it4788Prefix}/videos/${videoId}/stream`;
    }

    /**
     * Upload ảnh (avatar, coverImage...).
     * - Nếu Cloudinary được bật: upload thẳng lên Cloudinary (hỗ trợ image natively).
     * - Nếu không: wrap buffer ảnh vào mock file dạng video/mp4 để media server chấp nhận
     *   (cùng trick với thumbnail), trả về URL kèm ?is_thumb=true để proxy render đúng content-type.
     */
    async uploadImage(file: Express.Multer.File): Promise<string> {
        // if (this.useCloudinary) {
        //     return this.uploadToCloudinary(file);
        // }

        // Wrap ảnh thành mock video file để upload lên media server
        const mockFile: Express.Multer.File = {
            ...file,
            originalname: 'image.mp4',
            mimetype: 'video/mp4',
        };

        const formData = new FormData();
        const blob = new Blob([new Uint8Array(mockFile.buffer)], { type: mockFile.mimetype });
        formData.append('file', blob, mockFile.originalname);

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
                `Failed to upload image to media server: ${response.statusText} - ${errorText}`,
            );
        }

        const data = (await response.json()) as { video_id?: string; id?: string };
        const videoId = data.video_id || data.id;

        // Trả về URL kèm ?is_thumb=true để proxy set Content-Type: image/jpeg
        return `${this.serverUrl}/${this.it4788Prefix}/videos/${videoId}/stream?is_thumb=true`;
    }

    async getVideoResponse(videoId: string, range?: string): Promise<Response> {
        const headers: Record<string, string> = {
            'X-WHAM-Subject': this.subject,
            'X-WHAM-Api-Key': this.apiKey,
        };
        if (range) {
            headers['Range'] = range;
        }

        const response = await fetch(`${this.baseUrl}/v1/videos/${videoId}/download`, {
            method: 'GET',
            headers,
        });

        if (!response.ok && response.status !== 206) {
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
            // But make sure it uses /stream instead of /download
            return originalUrl.replace('/download', '/stream');
        }

        // If it's a direct storage URL, extract videoId and convert
        // Example: http://localhost:8000/v1/videos/vid_123/download
        const match = originalUrl.match(/\/v1\/videos\/([^/]+)/);
        if (match && match[1]) {
            const videoId = match[1];
            return `${this.serverUrl}/${this.it4788Prefix}/videos/${videoId}/stream`;
        }

        return originalUrl;
    }

    private async extractThumbnailFromVideo(
        videoFilePath: string,
        thumbnailFilePath: string,
    ): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            ffmpegFn(videoFilePath)
                .screenshots({
                    timestamps: [1], // Giây thứ 1
                    filename: path.basename(thumbnailFilePath),
                    folder: path.dirname(thumbnailFilePath),
                    size: '640x?', // Scale giữ tỷ lệ
                })
                .on('end', () => resolve())
                .on('error', (err: any) =>
                    reject(err instanceof Error ? err : new Error(String(err))),
                );
        });
    }

    async generateAndUploadThumbnail(
        videoFile: Express.Multer.File,
        videoUrl?: string,
    ): Promise<string> {
        if (videoUrl && videoUrl.includes('cloudinary.com')) {
            // Instantly generate the thumbnail URL using Cloudinary dynamic CDN transformations
            return videoUrl
                .replace('/video/upload/', '/video/upload/so_1/')
                .replace(/\.[^/.]+$/, '.jpg');
        }

        const tempDir = path.join(process.cwd(), 'temp_media');
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const tempVideoPath = path.join(tempDir, `temp-video-${uniqueSuffix}.mp4`);
        const tempThumbPath = path.join(tempDir, `temp-thumb-${uniqueSuffix}.jpg`);

        try {
            // 1. Tạo thư mục tạm nếu chưa có
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            // 2. Ghi video buffer ra file tạm
            await fs.promises.writeFile(tempVideoPath, videoFile.buffer);

            // 3. Trích xuất frame hình bằng FFmpeg
            await this.extractThumbnailFromVideo(tempVideoPath, tempThumbPath);

            // 4. Đọc file thumbnail vừa tạo vào Buffer
            const thumbBuffer = await fs.promises.readFile(tempThumbPath);

            // 5. Dựng đối tượng file giả lập để upload lên storage
            const mockThumbFile: Express.Multer.File = {
                fieldname: 'file',
                originalname: 'thumbnail.mp4',
                encoding: '7bit',
                mimetype: 'video/mp4',
                buffer: thumbBuffer,
                size: thumbBuffer.length,
                destination: '',
                filename: '',
                path: '',
                stream: null as any,
            };

            // 6. Upload ảnh thumbnail thông qua hàm upload của service
            const uploadedThumbUrl = await this.uploadFile(mockThumbFile);
            return `${uploadedThumbUrl}?is_thumb=true`;
        } catch (err) {
            console.error('Lỗi tự động tạo thumbnail:', err);
            return videoUrl || ''; // Trả về link video làm fallback nếu lỗi
        } finally {
            // 7. Đảm bảo dọn dẹp sạch sẽ các file tạm trên ổ đĩa
            try {
                if (fs.existsSync(tempVideoPath)) {
                    await fs.promises.unlink(tempVideoPath);
                }
                if (fs.existsSync(tempThumbPath)) {
                    await fs.promises.unlink(tempThumbPath);
                }
            } catch (cleanupErr) {
                console.error('Không thể dọn dẹp file tạm:', cleanupErr);
            }
        }
    }
}
