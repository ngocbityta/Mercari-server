import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MediaService {
    private readonly baseUrl: string;
    private readonly apiKey: string;
    private readonly subject: string;

    constructor(private configService: ConfigService) {
        this.baseUrl = this.configService.get<string>('MEDIA_BASE_URL') || 'http://localhost:8000';
        this.apiKey = this.configService.get<string>('MEDIA_API_KEY') || 'default_key';
        this.subject = this.configService.get<string>('MEDIA_API_SUBJECT') || 'default_subject';
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
            throw new Error(`Failed to upload to media server: ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        const videoId = data.id;

        // Return the download URL as a string to be stored in DB
        return `${this.baseUrl}/v1/videos/${videoId}/download`;
    }
}
