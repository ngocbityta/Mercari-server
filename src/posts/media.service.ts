import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MediaService {
    private readonly baseUrl: string;
    private readonly apiSubject: string;
    private readonly apiKey: string;

    constructor(private readonly configService: ConfigService) {
        this.baseUrl = this.configService.get<string>('MEDIA_BASE_URL', 'http://localhost:8000');
        this.apiSubject = this.configService.get<string>('MEDIA_API_SUBJECT', 'test-service');
        this.apiKey = this.configService.get<string>('MEDIA_API_KEY', 'test-key');
    }

    /**
     * Upload a file to the media server and return the full download URL.
     * e.g. http://localhost:8000/v1/videos/vid_xxx/download
     */
    async uploadFile(file: Express.Multer.File): Promise<string> {
        const formData = new FormData();
        const blob = new Blob([new Uint8Array(file.buffer)], { type: file.mimetype });
        formData.append('file', blob, file.originalname);

        const response = await fetch(`${this.baseUrl}/v1/videos/upload`, {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'X-WHAM-Subject': this.apiSubject,
                'X-WHAM-Api-Key': this.apiKey,
                // Do NOT set Content-Type — fetch sets it automatically with the multipart boundary
            },
            body: formData,
        });

        if (!response.ok) {
            const text = await response.text();
            throw new InternalServerErrorException(
                `Media server upload failed [${response.status}]: ${text}`,
            );
        }

        const data = (await response.json()) as {
            video_id: string;
            filename: string;
            status: string;
        };

        return `${this.baseUrl}/v1/videos/${data.video_id}/download`;
    }
}
