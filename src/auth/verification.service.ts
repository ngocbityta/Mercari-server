import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.ts';
import { TokenService } from './token.service.ts';

@Injectable()
export class VerificationService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly tokenService: TokenService,
    ) {}

    /**
     * Generate and store a new verify code for a phonenumber
     */
    async generateAndStoreCode(phonenumber: string): Promise<string> {
        const verifyCode = this.tokenService.generateVerifyCode();

        // Delete existing codes for this phonenumber
        await this.prisma.verifyCode.deleteMany({
            where: { phonenumber },
        });

        // Store new code
        await this.prisma.verifyCode.create({
            data: {
                phonenumber,
                code: verifyCode,
            },
        });

        return verifyCode;
    }

    /**
     * Get the most recent verify code for a phonenumber
     */
    async getRecentCode(phonenumber: string) {
        return this.prisma.verifyCode.findFirst({
            where: { phonenumber },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Validate a verify code
     */
    async validateCode(phonenumber: string, code: string): Promise<boolean> {
        const verifyRecord = await this.getRecentCode(phonenumber);
        return !!(verifyRecord && verifyRecord.code === code);
    }

    /**
     * Delete all verify codes for a phonenumber
     */
    async deleteCodes(phonenumber: string): Promise<void> {
        await this.prisma.verifyCode.deleteMany({
            where: { phonenumber },
        });
    }
}
