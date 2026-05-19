import { Controller, Get, Param, Res, HttpStatus } from '@nestjs/common';
import { MediaService } from './media.service';
import type { Response } from 'express';
import { Readable } from 'stream';
import { PrismaService } from '../prisma/prisma.service';

@Controller('videos')
export class MediaController {
    constructor(
        private readonly mediaService: MediaService,
        private readonly prisma: PrismaService,
    ) {}

    @Get(':id/download')
    async download(@Param('id') id: string, @Res() res: Response) {
        try {
            const response = await this.mediaService.getVideoResponse(id);

            // Forward headers
            let contentType = response.headers.get('content-type');
            const contentLength = response.headers.get('content-length');
            const contentDisposition = response.headers.get('content-disposition');

            // 1. Check if filename contains _thumb (fallback)
            let isThumbnail = false;
            if (contentDisposition && contentDisposition.includes('_thumb')) {
                isThumbnail = true;
            }

            // 2. Query database to reliably check if id is registered as a thumbnail (100% robust)
            if (!isThumbnail) {
                const post = await this.prisma.post.findFirst({
                    where: {
                        OR: [
                            { leftVideoThumb: { contains: id } },
                            { rightVideoThumb: { contains: id } },
                        ],
                    },
                });
                if (post) {
                    isThumbnail = true;
                }
            }

            if (isThumbnail) {
                contentType = 'image/jpeg';
            }

            if (contentType) {
                res.setHeader('Content-Type', contentType);
            }
            if (contentLength) {
                res.setHeader('Content-Length', contentLength);
            }

            if (isThumbnail) {
                res.setHeader('Content-Disposition', 'inline; filename="thumbnail.jpg"');
            } else if (contentDisposition) {
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
