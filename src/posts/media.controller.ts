import { Controller, Get, Param, Res, Headers, HttpStatus, Query } from '@nestjs/common';
import { MediaService } from './media.service';
import type { Response } from 'express';
import { Readable } from 'stream';

@Controller('videos')
export class MediaController {
    constructor(private readonly mediaService: MediaService) {}

    @Get(':id/stream')
    async stream(
        @Param('id') id: string,
        @Headers('range') range: string,
        @Query('is_thumb') isThumb: string,
        @Res() res: Response,
    ) {
        try {
            const response = await this.mediaService.getVideoResponse(id, range);

            // Forward headers
            const contentType = response.headers.get('content-type');
            const contentLength = response.headers.get('content-length');
            const acceptRanges = response.headers.get('accept-ranges');
            const contentRange = response.headers.get('content-range');

            if (isThumb === 'true') {
                res.setHeader('Content-Type', 'image/jpeg');
            } else if (contentType) {
                res.setHeader('Content-Type', contentType);
            }
            if (contentLength) {
                res.setHeader('Content-Length', contentLength);
            }
            if (acceptRanges) {
                res.setHeader('Accept-Ranges', acceptRanges);
            }
            if (contentRange) {
                res.setHeader('Content-Range', contentRange);
            }

            res.status(response.status);

            // Stream the body
            if (response.body) {
                // Node 18 fetch body is a Web Stream, convert to Node Stream
                Readable.fromWeb(
                    response.body as unknown as Parameters<typeof Readable.fromWeb>[0],
                ).pipe(res);
            } else {
                res.status(HttpStatus.NOT_FOUND).send('Video not found');
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(message);
        }
    }

    @Get(':id/download')
    async download(
        @Param('id') id: string,
        @Query('is_thumb') isThumb: string,
        @Res() res: Response,
    ) {
        try {
            const response = await this.mediaService.getVideoResponse(id);

            // Forward headers
            const contentType = response.headers.get('content-type');
            const contentLength = response.headers.get('content-length');
            const contentDisposition = response.headers.get('content-disposition');

            if (isThumb === 'true') {
                res.setHeader('Content-Type', 'image/jpeg');
                res.setHeader('Content-Disposition', 'attachment; filename="thumbnail.jpg"');
            } else {
                if (contentType) {
                    res.setHeader('Content-Type', contentType);
                }
                if (contentDisposition) {
                    res.setHeader('Content-Disposition', contentDisposition);
                }
            }
            if (contentLength) {
                res.setHeader('Content-Length', contentLength);
            }

            // Stream the body
            if (response.body) {
                // Node 18 fetch body is a Web Stream, convert to Node Stream
                Readable.fromWeb(
                    response.body as unknown as Parameters<typeof Readable.fromWeb>[0],
                ).pipe(res);
            } else {
                res.status(HttpStatus.NOT_FOUND).send('Video not found');
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(message);
        }
    }
}
