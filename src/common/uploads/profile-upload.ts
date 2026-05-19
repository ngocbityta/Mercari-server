import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { extname, join } from 'node:path';

export interface UploadedMultipartFile {
    fieldname: string;
    originalname: string;
    mimetype: string;
    size: number;
    buffer?: Buffer;
}

export interface UploadedMultipartFileFields {
    avatar?: UploadedMultipartFile[];
    cover_image?: UploadedMultipartFile[];
}

const USER_UPLOAD_DIR = join(process.cwd(), 'uploads', 'users');
const USER_UPLOAD_URL_PREFIX = '/uploads/users';

const IMAGE_MIME_TO_EXTENSION: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
};

const ALLOWED_IMAGE_EXTENSIONS = new Set(Object.values(IMAGE_MIME_TO_EXTENSION));

function createProfileImageUploadOptions(maxFiles: number): MulterOptions {
    return {
        limits: {
            fileSize: 5 * 1024 * 1024,
            files: maxFiles,
        },
        fileFilter: (_request, file, callback) => {
            if (!IMAGE_MIME_TO_EXTENSION[file.mimetype]) {
                callback(
                    new BadRequestException('Only jpeg, png, or webp images are allowed'),
                    false,
                );
                return;
            }

            callback(null, true);
        },
    };
}

export const PROFILE_AVATAR_UPLOAD_OPTIONS: MulterOptions = createProfileImageUploadOptions(1);
export const PROFILE_USER_INFO_UPLOAD_OPTIONS: MulterOptions = createProfileImageUploadOptions(2);

export function getFirstUploadedFile(
    files: UploadedMultipartFile[] | undefined,
    fieldNames: string[],
): UploadedMultipartFile | undefined {
    if (!files?.length) {
        return undefined;
    }

    return files.find((file) => fieldNames.includes(file.fieldname));
}

export async function saveUserUploadedImage(file: UploadedMultipartFile): Promise<string> {
    if (!file.buffer) {
        throw new Error('Upload file failed');
    }

    await fs.mkdir(USER_UPLOAD_DIR, { recursive: true });

    const extension = getSafeImageExtension(file);
    const filename = `${Date.now()}-${randomUUID()}${extension}`;
    const destination = join(USER_UPLOAD_DIR, filename);

    await fs.writeFile(destination, file.buffer);

    return `${USER_UPLOAD_URL_PREFIX}/${filename}`;
}

function getSafeImageExtension(file: UploadedMultipartFile): string {
    const extensionFromMime = IMAGE_MIME_TO_EXTENSION[file.mimetype];
    if (extensionFromMime) {
        return extensionFromMime;
    }

    const extensionFromName = extname(file.originalname).toLowerCase();
    if (ALLOWED_IMAGE_EXTENSIONS.has(extensionFromName)) {
        return extensionFromName;
    }

    return '.jpg';
}
