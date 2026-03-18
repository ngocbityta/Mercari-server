import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.ts';
import { User, UserStatus } from '@prisma/client';

@Injectable()
export class AccountService {
    constructor(private readonly prisma: PrismaService) {}

    async changePassword(user: User, password: string, newPassword: string) {
        if (password === newPassword) {
            throw new BadRequestException('Mật khẩu mới không được trùng với mật khẩu cũ');
        }

        const isMatch = user.password === password;
        if (!isMatch) {
            throw new BadRequestException('Mật khẩu cũ không chính xác');
        }

        if (newPassword.length < 6 || newPassword.length > 50) {
            throw new BadRequestException('Mật khẩu mới phải từ 6 đến 50 ký tự');
        }

        const getLongestCommonSubstring = (s1: string, s2: string): number => {
            const m = s1.length;
            const n = s2.length;
            let maxLen = 0;
            const dp: number[][] = Array.from(
                { length: m + 1 },
                () => Array(n + 1).fill(0) as number[],
            );
            for (let i = 1; i <= m; i++) {
                for (let j = 1; j <= n; j++) {
                    if (s1[i - 1] === s2[j - 1]) {
                        dp[i][j] = dp[i - 1][j - 1] + 1;
                        maxLen = Math.max(maxLen, dp[i][j]);
                    }
                }
            }
            return maxLen;
        };

        const lcsLength = getLongestCommonSubstring(password, newPassword);
        if (lcsLength / newPassword.length >= 0.8) {
            throw new BadRequestException('Mật khẩu mới quá giống mật khẩu cũ');
        }

        await this.prisma.user.update({
            where: { id: user.id },
            data: { password: newPassword },
        });

        return {};
    }

    checkNewVersion(user: User, lastUpdate: string) {
        if (!lastUpdate || typeof lastUpdate !== 'string') {
            throw new BadRequestException('Parameter last_update is required');
        }

        return {
            version: {
                version: '1.0.0',
                active: user.status === UserStatus.ACTIVE ? '1' : '0',
                required: '0',
                url: 'https://example.com/app',
            },
            user: {
                id: user.id,
                active: user.status === UserStatus.ACTIVE ? '1' : '0',
            },
            badge: '0',
            unread_message: '0',
            now: '1.0.0',
        };
    }
}
