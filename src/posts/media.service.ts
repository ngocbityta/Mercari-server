import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import 'multer';
import * as fs from 'fs';
import * as path from 'path';
import ffmpegPath from 'ffmpeg-static';
import ffmpeg from 'fluent-ffmpeg';

if (typeof ffmpegPath === 'string') {
    ffmpeg.setFfmpegPath(ffmpegPath);
} else if (ffmpegPath && (ffmpegPath as any).default) {
    ffmpeg.setFfmpegPath((ffmpegPath as any).default);
}

@Injectable()
export class MediaService {
    private readonly baseUrl: string;
    private readonly apiKey: string;
    private readonly subject: string;
    private readonly serverUrl: string;
    private readonly it4788Prefix = 'it4788';

    constructor(private configService: ConfigService) {
        this.baseUrl = this.configService.get<string>('MEDIA_BASE_URL') || 'http://localhost:8000';
        this.apiKey = this.configService.get<string>('MEDIA_API_KEY') || 'default_key';
        this.subject = this.configService.get<string>('MEDIA_API_SUBJECT') || 'default_subject';
        this.serverUrl = this.configService.get<string>('SERVER_URL') || 'http://localhost:3000';
    }

    async uploadFile(file: Express.Multer.File): Promise<string> {
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

    async generateAndUploadThumbnail(videoFile: Express.Multer.File): Promise<string> {
        const tempDir = path.join(process.cwd(), 'tmp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const uniqueId = Math.random().toString(36).substring(7);
        const tempVideoPath = path.join(tempDir, `${uniqueId}_input.mp4`);
        const tempThumbPath = path.join(tempDir, `${uniqueId}_thumb.jpg`);

        try {
            // 1. Write video buffer to temporary file
            await fs.promises.writeFile(tempVideoPath, videoFile.buffer);

            // 2. Extract first frame using fluent-ffmpeg
            await new Promise<void>((resolve, reject) => {
                ffmpeg(tempVideoPath)
                    .seekInput(1) // seek to 1 second
                    .frames(1)
                    .output(tempThumbPath)
                    .on('end', () => resolve())
                    .on('error', (err) => reject(err))
                    .run();
            });

            // 3. Read generated thumbnail image
            if (!fs.existsSync(tempThumbPath)) {
                throw new Error('Thumbnail was not generated');
            }
            const thumbBuffer = await fs.promises.readFile(tempThumbPath);

            // 4. Create mock Express.Multer.File object
            const mockFile: Express.Multer.File = {
                fieldname: 'file',
                originalname: `${path.basename(videoFile.originalname, path.extname(videoFile.originalname))}_thumb.mp4`,
                encoding: '7bit',
                mimetype: 'video/mp4',
                buffer: thumbBuffer,
                size: thumbBuffer.length,
                stream: null as any,
                destination: '',
                filename: '',
                path: '',
            };

            // 5. Upload thumbnail
            return await this.uploadFile(mockFile);
        } finally {
            // Cleanup temp files
            try {
                if (fs.existsSync(tempVideoPath)) {
                    await fs.promises.unlink(tempVideoPath);
                }
                if (fs.existsSync(tempThumbPath)) {
                    await fs.promises.unlink(tempThumbPath);
                }
            } catch (err) {
                console.error('Error cleaning up temp video files:', err);
            }
        }
    }
}
