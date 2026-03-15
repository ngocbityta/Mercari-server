import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PostsService {
  constructor(private prisma: PrismaService) {}

  async addPost(ownerId: string, content: string, media: string[], hashtags?: string[]) {
    const post = await this.prisma.post.create({
      data: {
        ownerId,
        content,
        media,
        hashtags: hashtags || [],
      },
      include: {
        owner: true,
      },
    });
    return post;
  }

  async editPost(postId: string, content?: string, media?: string[], hashtags?: string[]) {
    const data: any = {};
    if (content !== undefined) data.content = content;
    if (media !== undefined) data.media = media;
    if (hashtags !== undefined) data.hashtags = hashtags;

    const post = await this.prisma.post.update({
      where: { id: postId },
      data,
      include: {
        owner: true,
      },
    });
    return post;
  }

  async deletePost(postId: string) {
    await this.prisma.post.delete({
      where: { id: postId },
    });
    return { message: 'Post deleted successfully' };
  }

  async getPost(postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        owner: true,
      },
    });
    return post;
  }

  async getListPosts(index: number = 0, count: number = 10, lastId?: string) {
    const skip = index * count;
    const where: any = {};

    if (lastId) {
      const lastPost = await this.prisma.post.findUnique({
        where: { id: lastId },
      });
      if (lastPost) {
        where.createdAt = { lt: lastPost.createdAt };
      }
    }

    const posts = await this.prisma.post.findMany({
      where,
      include: {
        owner: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: count,
    });

    const total = await this.prisma.post.count({ where });

    return {
      data: posts,
      total,
      index,
      count,
    };
  }

  async checkNewItem(lastId: string) {
    if (!lastId) return { hasNew: false, count: 0 };

    const lastPost = await this.prisma.post.findUnique({
      where: { id: lastId },
    });

    if (!lastPost) return { hasNew: false, count: 0 };

    const newCount = await this.prisma.post.count({
      where: {
        createdAt: { gt: lastPost.createdAt },
      },
    });

    return { hasNew: newCount > 0, count: newCount };
  }

  async searchPosts(query: string, index: number = 0, count: number = 10) {
    const skip = index * count;

    const posts = await this.prisma.post.findMany({
      where: {
        OR: [
          { content: { contains: query, mode: 'insensitive' } },
          { hashtags: { hasSome: [query] } },
        ],
      },
      include: {
        owner: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: count,
    });

    const total = await this.prisma.post.count({
      where: {
        OR: [
          { content: { contains: query, mode: 'insensitive' } },
          { hashtags: { hasSome: [query] } },
        ],
      },
    });

    return {
      data: posts,
      total,
      index,
      count,
    };
  }

  async getSavedSearch(userId: string) {
    // Placeholder - will implement with SavedSearch model later
    return [];
  }

  async delSavedSearch(searchId: string) {
    // Placeholder - will implement with SavedSearch model later
    return { message: 'Saved search deleted' };
  }
}
