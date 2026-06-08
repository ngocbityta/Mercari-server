import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { PrismaService } from '../prisma/prisma.service.ts';

@Injectable()
export class SearchService {
    private readonly logger = new Logger(SearchService.name);

    constructor(
        private readonly elasticsearchService: ElasticsearchService,
        private readonly prisma: PrismaService,
    ) {}

    // ---- POSTS ----

    async indexPost(post: any) {
        try {
            await (this.elasticsearchService as any).index({
                index: 'posts',
                id: post.id,
                document: {
                    content: post.content,
                    hashtags: post.hashtags,
                    ownerId: post.ownerId,
                    createdAt: post.createdAt,
                    updatedAt: post.updatedAt,
                },
            });
            this.logger.log(`Indexed post ${post.id}`);
        } catch (error) {
            this.logger.error(`Error indexing post ${post.id}: ${error.message}`);
        }
    }

    async updatePost(post: any) {
        try {
            await (this.elasticsearchService as any).update({
                index: 'posts',
                id: post.id,
                doc: {
                    content: post.content,
                    hashtags: post.hashtags,
                    updatedAt: post.updatedAt,
                },
            });
            this.logger.log(`Updated post ${post.id} in index`);
        } catch (error) {
            this.logger.error(`Error updating post ${post.id} in index: ${error.message}`);
        }
    }

    async removePost(postId: string) {
        try {
            await (this.elasticsearchService as any).delete({
                index: 'posts',
                id: postId,
            });
            this.logger.log(`Removed post ${postId} from index`);
        } catch (error) {
            // It might fail if the document was not found, ignore in that case or log warning
            this.logger.warn(
                `Error removing post ${postId} from index (might not exist): ${error.message}`,
            );
        }
    }

    async searchPosts(text: string, hashtags?: string[]) {
        const must: any[] = [];

        if (text) {
            must.push({
                multi_match: {
                    query: text,
                    fields: ['content'],
                },
            });
        }

        if (hashtags && hashtags.length > 0) {
            // Match any of the hashtags
            must.push({
                terms: {
                    'hashtags.keyword': hashtags,
                },
            });
        }

        try {
            const result = await (this.elasticsearchService as any).search({
                index: 'posts',
                query: {
                    bool: {
                        must: must.length > 0 ? must : { match_all: {} },
                    },
                },
                sort: [{ createdAt: { order: 'desc' } }],
            });
            return result.hits.hits.map((hit: any) => ({
                id: hit._id,
                ...hit._source,
            }));
        } catch (error) {
            this.logger.error(`Error searching posts: ${error.message}`);
            return [];
        }
    }

    // ---- USERS ----

    async indexUser(user: any) {
        try {
            await (this.elasticsearchService as any).index({
                index: 'users',
                id: user.id,
                document: {
                    username: user.username,
                    description: user.description,
                    role: user.role,
                    createdAt: user.createdAt,
                },
            });
            this.logger.log(`Indexed user ${user.id}`);
        } catch (error) {
            this.logger.error(`Error indexing user ${user.id}: ${error.message}`);
        }
    }

    async updateUser(user: any) {
        try {
            await (this.elasticsearchService as any).update({
                index: 'users',
                id: user.id,
                doc: {
                    username: user.username,
                    description: user.description,
                    role: user.role,
                },
            });
            this.logger.log(`Updated user ${user.id} in index`);
        } catch (error) {
            this.logger.error(`Error updating user ${user.id} in index: ${error.message}`);
        }
    }

    async removeUser(userId: string) {
        try {
            await (this.elasticsearchService as any).delete({
                index: 'users',
                id: userId,
            });
            this.logger.log(`Removed user ${userId} from index`);
        } catch (error) {
            this.logger.warn(
                `Error removing user ${userId} from index (might not exist): ${error.message}`,
            );
        }
    }

    async searchUsers(text: string) {
        try {
            const result = await (this.elasticsearchService as any).search({
                index: 'users',
                query: {
                    multi_match: {
                        query: text,
                        fields: ['username', 'description'],
                    },
                },
            });
            return result.hits.hits.map((hit: any) => ({
                id: hit._id,
                ...hit._source,
            }));
        } catch (error) {
            this.logger.error(`Error searching users: ${error.message}`);
            return [];
        }
    }

    async syncAll() {
        this.logger.log('Starting sync all data to Elasticsearch...');

        let postsCount = 0;
        const posts = await this.prisma.post.findMany();
        for (const post of posts) {
            await this.indexPost(post);
            postsCount++;
        }

        let usersCount = 0;
        const users = await this.prisma.user.findMany();
        for (const user of users) {
            await this.indexUser(user);
            usersCount++;
        }

        this.logger.log(`Sync completed. Indexed ${postsCount} posts and ${usersCount} users.`);
        return { message: 'Sync completed', postsCount, usersCount };
    }
}
