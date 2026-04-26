import { Controller, Get, Param, Res, HttpStatus } from '@nestjs/common';
import { MediaService } from './media.service';
import type { Response } from 'express';
import { Readable } from 'stream';

@Controller('videos')
export class MediaController {
    constructor(private readonly mediaService: MediaService) {}

    @Get(':id/download')
    async download(@Param('id') id: string, @Res() res: Response) {
        try {
            const response = await this.mediaService.getVideoResponse(id);

            // Forward headers
            const contentType = response.headers.get('content-type');
            const contentLength = response.headers.get('content-length');
            const contentDisposition = response.headers.get('content-disposition');

            if (contentType) {
                res.setHeader('Content-Type', contentType);
            }
            if (contentLength) {
                res.setHeader('Content-Length', contentLength);
            }
            if (contentDisposition) {
                res.setHeader('Content-Disposition', contentDisposition);
            }

            // Stream the body
            if (response.body) {
                // Node 18 fetch body is a Web Stream, convert to Node Stream
                Readable.fromWeb(response.body as any).pipe(res);
            } else {
                res.status(HttpStatus.NOT_FOUND).send('Video not found');
            }
        } catch (error) {
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(error.message);
        }
    }
}
