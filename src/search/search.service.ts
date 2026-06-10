import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { PrismaService } from '../prisma/prisma.service.ts';

@Injectable()
export class SearchService implements OnModuleInit {
    private readonly logger = new Logger(SearchService.name);

    private readonly POSTS_INDEX = 'posts';

    private readonly USERS_INDEX = 'users';

    constructor(
        private readonly elasticsearchService: ElasticsearchService,
        private readonly prisma: PrismaService,
    ) {}

    async onModuleInit() {
        try {
            await this.waitForElasticsearch();
            await this.syncAll();
            this.logger.log('Initial sync to Elasticsearch completed');
        } catch (error) {
            this.logger.error(`Error during initial sync to Elasticsearch: ${error.message}`);
        }
    }

    private async waitForElasticsearch() {
        const maxAttempts = 30;
        const delayMs = 2000;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const health = await this.elasticsearchService.cluster.health({
                    wait_for_status: 'yellow',
                    timeout: '5s',
                });

                this.logger.log(`Elasticsearch ready (${health.status})`);

                return;
            } catch {
                this.logger.warn(`Waiting for Elasticsearch (${attempt}/${maxAttempts})`);

                await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
        }

        throw new Error('Elasticsearch failed to become ready');
    }

    // ---- POSTS ----

    async indexPost(post: any) {
        try {
            await this.elasticsearchService.index({
                index: this.POSTS_INDEX,
                id: post.id,
                document: this.mapPostToDocument(post),
            });
            this.logger.log(`Indexed post ${post.id}`);
        } catch (error) {
            this.logger.error(`Error indexing post ${post.id}: ${error.message}`);
        }
    }

    private mapPostToDocument(
        post: any,
    ): { content: any; hashtags: any; ownerId: any; createdAt: any; updatedAt: any } | undefined {
        return {
            content: post.content,
            hashtags: post.hashtags,
            ownerId: post.ownerId,
            createdAt: post.createdAt,
            updatedAt: post.updatedAt,
        };
    }

    async updatePost(post: any) {
        try {
            await this.elasticsearchService.update({
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
            await this.elasticsearchService.delete({
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
            const result = await this.elasticsearchService.search({
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
            await this.elasticsearchService.index({
                index: this.USERS_INDEX,
                id: user.id,
                document: this.mapUserToDocument(user),
            });
            this.logger.log(`Indexed user ${user.id}`);
        } catch (error) {
            this.logger.error(`Error indexing user ${user.id}: ${error.message}`);
        }
    }

    private mapUserToDocument(
        user: any,
    ): { username: any; description: any; role: any; createdAt: any } | undefined {
        return {
            username: user.username,
            description: user.description,
            role: user.role,
            createdAt: user.createdAt,
        };
    }

    async updateUser(user: any) {
        try {
            await this.elasticsearchService.update({
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
            await this.elasticsearchService.delete({
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
            const result = await this.elasticsearchService.search({
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

    private readonly BATCH_SIZE = 1000;

    async syncAll() {
        this.logger.log('Starting sync all data to Elasticsearch...');

        const postsCount = await this.syncPosts();
        const usersCount = await this.syncUsers();

        this.logger.log(`Sync completed. Indexed ${postsCount} posts and ${usersCount} users.`);

        return {
            message: 'Sync completed',
            postsCount,
            usersCount,
        };
    }

    private async syncPosts(): Promise<number> {
        let total = 0;
        let cursor: string | undefined;

        while (true) {
            const posts = await this.prisma.post.findMany({
                take: this.BATCH_SIZE,
                ...(cursor && {
                    skip: 1,
                    cursor: { id: cursor },
                }),
                orderBy: { id: 'asc' },
            });

            if (posts.length === 0) {
                break;
            }

            const operations = posts.flatMap((post) => [
                {
                    index: {
                        _index: this.POSTS_INDEX,
                        _id: post.id,
                    },
                },
                this.mapPostToDocument(post),
            ]);

            const response = await this.elasticsearchService.bulk({
                refresh: false,
                operations,
            });

            if (response.errors) {
                this.logger.error('Bulk post indexing contained errors');
            }

            total += posts.length;
            cursor = posts[posts.length - 1].id;

            this.logger.log(`Indexed ${total} posts`);
        }

        return total;
    }

    private async syncUsers(): Promise<number> {
        let total = 0;
        let cursor: string | undefined;

        while (true) {
            const users = await this.prisma.user.findMany({
                take: this.BATCH_SIZE,
                ...(cursor && {
                    skip: 1,
                    cursor: { id: cursor },
                }),
                orderBy: { id: 'asc' },
            });

            if (users.length === 0) {
                break;
            }

            const operations = users.flatMap((user) => [
                {
                    index: {
                        _index: this.USERS_INDEX,
                        _id: user.id,
                    },
                },
                this.mapUserToDocument(user),
            ]);

            const response = await this.elasticsearchService.bulk({
                refresh: false,
                operations,
            });

            if (response.errors) {
                this.logger.error('Bulk user indexing contained errors');
            }

            total += users.length;
            cursor = users[users.length - 1].id;

            this.logger.log(`Indexed ${total} users`);
        }

        return total;
    }
}
