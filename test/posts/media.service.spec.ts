import { Test, TestingModule } from '@nestjs/testing';
import { MediaService } from '../../src/posts/media.service';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

jest.mock('cloudinary', () => ({
    v2: {
        config: jest.fn(),
        uploader: {
            upload_stream: jest.fn(),
        },
    },
}));

describe('MediaService', () => {
    let service: MediaService;

    const mockConfig = {
        MEDIA_BASE_URL: 'http://localhost:8000',
        MEDIA_API_KEY: 'mock_key',
        MEDIA_API_SUBJECT: 'mock_subject',
        SERVER_URL: 'http://localhost:3000',
        CLOUDINARY_CLOUD_NAME: 'mock_cloud',
        CLOUDINARY_API_KEY: 'mock_c_key',
        CLOUDINARY_API_SECRET: 'mock_c_secret',
        USE_CLOUDINARY: 'true',
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                MediaService,
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn((key: string) => mockConfig[key as keyof typeof mockConfig]),
                    },
                },
            ],
        }).compile();

        service = module.get<MediaService>(MediaService);
        (service as any).useCloudinary = true;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('getProxiedUrl', () => {
        it('should bypass Cloudinary URLs', () => {
            const cloudinaryUrl =
                'https://res.cloudinary.com/dxqd8pxuj/video/upload/v12345/sample.mp4';
            expect(service.getProxiedUrl(cloudinaryUrl)).toBe(cloudinaryUrl);
        });

        it('should proxy RunPod server URLs', () => {
            const directUrl = 'http://localhost:8000/v1/videos/vid_123/download';
            expect(service.getProxiedUrl(directUrl)).toBe(
                'http://localhost:3000/it4788/videos/vid_123/download',
            );
        });

        it('should return already proxied URLs as-is', () => {
            const proxiedUrl = 'http://localhost:3000/it4788/videos/vid_123/download';
            expect(service.getProxiedUrl(proxiedUrl)).toBe(proxiedUrl);
        });
    });

    describe.skip('uploadFile - Cloudinary', () => {
        it('should upload video to Cloudinary when configured', async () => {
            const mockSecureUrl = 'https://res.cloudinary.com/dxqd8pxuj/video/upload/sample.mp4';
            const mockUploadStream = jest.fn(
                (options: any, callback: (error: any, result: any) => void) => {
                    setTimeout(() => {
                        callback(null, { secure_url: mockSecureUrl });
                    }, 0);
                    return {
                        end: jest.fn(),
                    };
                },
            );

            (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation(mockUploadStream);

            const mockFile = {
                buffer: Buffer.from('fake-video-content'),
                mimetype: 'video/mp4',
                originalname: 'video.mp4',
            } as Express.Multer.File;

            const url = await service.uploadFile(mockFile);
            expect(url).toBe(mockSecureUrl);
            expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
                expect.objectContaining({
                    resource_type: 'video',
                    folder: 'mercari_media',
                }),
                expect.any(Function),
            );
        });

        it('should upload image to Cloudinary when configured', async () => {
            const mockSecureUrl = 'https://res.cloudinary.com/dxqd8pxuj/image/upload/sample.jpg';
            const mockUploadStream = jest.fn(
                (options: any, callback: (error: any, result: any) => void) => {
                    setTimeout(() => {
                        callback(null, { secure_url: mockSecureUrl });
                    }, 0);
                    return {
                        end: jest.fn(),
                    };
                },
            );

            (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation(mockUploadStream);

            const mockFile = {
                buffer: Buffer.from('fake-image-content'),
                mimetype: 'image/jpeg',
                originalname: 'image.jpg',
            } as Express.Multer.File;

            const url = await service.uploadFile(mockFile);
            expect(url).toBe(mockSecureUrl);
            expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
                expect.objectContaining({
                    resource_type: 'image',
                    folder: 'mercari_media',
                }),
                expect.any(Function),
            );
        });
    });
});
