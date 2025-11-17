import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AiAgentService } from '../ai/services/agent.service';
import {
  SendMessageDto,
  QueryConversationsDto,
  SendMessageResponse,
  ConversationResponse,
} from './dto/chat.dto';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private prisma: PrismaService,
    private aiAgent: AiAgentService,
  ) {}

  async sendMessage(
    userId: string,
    dto: SendMessageDto,
  ): Promise<SendMessageResponse> {
    this.logger.log(`User ${userId} sending message`);

    let conversation;

    // Get or create conversation
    if (dto.conversationId) {
      conversation = await this.prisma.conversation.findFirst({
        where: {
          id: dto.conversationId,
          userId,
        },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 20, // Last 20 messages for context
          },
        },
      });

      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }
    } else {
      // Create new conversation
      const title = this.generateTitle(dto.message);
      conversation = await this.prisma.conversation.create({
        data: {
          userId,
          title,
          totalMessages: 0,
        },
        include: {
          messages: true,
        },
      });

      this.logger.log(`Created new conversation: ${conversation.id}`);
    }

    // Save user message
    const userMessage = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: dto.message,
      },
    });

    // Get conversation history for AI context
    const history = conversation.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Get AI response
    this.logger.log('Generating AI response...');
    let aiResponseData: { text: string; structured: any };
    try {
      aiResponseData = await this.aiAgent.chat(dto.message, history);
    } catch (error) {
      this.logger.error('AI Agent error:', error);
      aiResponseData = {
        text: 'I apologize, but I encountered an error processing your request. Please try again or rephrase your question.',
        structured: {
          summary: 'Error occurred',
          overallRisk: 'MODERATE',
          criticalAlerts: [],
          recommendations: [],
        },
      };
    }

    // Save AI response
    const aiMessage = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: aiResponseData.text,
      },
    });

    // Update conversation metadata
    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        totalMessages: { increment: 2 },
        lastMessageAt: new Date(),
      },
    });

    this.logger.log(
      `Message processed successfully for conversation ${conversation.id}`,
    );

    return {
      conversation: {
        id: conversation.id,
        title: conversation.title,
        machineId: conversation.machineId,
        totalMessages: conversation.totalMessages + 2,
        lastMessageAt: new Date(),
        createdAt: conversation.createdAt,
      },
      message: {
        id: userMessage.id,
        role: userMessage.role,
        content: userMessage.content,
        createdAt: userMessage.createdAt,
      },
      aiResponse: {
        id: aiMessage.id,
        role: aiMessage.role,
        content: aiMessage.content,
        createdAt: aiMessage.createdAt,
      },
      structuredData: aiResponseData.structured,
    };
  }

  async getConversations(
    userId: string,
    query: QueryConversationsDto,
  ): Promise<{ data: ConversationResponse[]; meta: any }> {
    const { limit = 20, offset = 0, machineId } = query;

    const where = {
      userId,
      ...(machineId && { machineId }),
    };

    const [conversations, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { lastMessageAt: 'desc' },
        include: {
          machine: {
            select: {
              productId: true,
              name: true,
              type: true,
            },
          },
        },
      }),
      this.prisma.conversation.count({ where }),
    ]);

    return {
      data: conversations.map((c) => ({
        id: c.id,
        title: c.title,
        machineId: c.machineId,
        totalMessages: c.totalMessages,
        lastMessageAt: c.lastMessageAt,
        createdAt: c.createdAt,
      })),
      meta: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    };
  }

  async getConversation(
    userId: string,
    conversationId: string,
  ): Promise<ConversationResponse> {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        machine: {
          select: {
            productId: true,
            name: true,
            type: true,
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return {
      id: conversation.id,
      title: conversation.title,
      machineId: conversation.machineId,
      totalMessages: conversation.totalMessages,
      lastMessageAt: conversation.lastMessageAt,
      createdAt: conversation.createdAt,
      messages: conversation.messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt,
      })),
    };
  }

  async deleteConversation(
    userId: string,
    conversationId: string,
  ): Promise<{ message: string }> {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    await this.prisma.conversation.delete({
      where: { id: conversationId },
    });

    this.logger.log(`Deleted conversation ${conversationId}`);

    return { message: 'Conversation deleted successfully' };
  }

  private generateTitle(message: string): string {
    // Generate a short title from the first message
    const maxLength = 50;
    const cleaned = message.trim();

    if (cleaned.length <= maxLength) {
      return cleaned;
    }

    // Try to cut at a word boundary
    const truncated = cleaned.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace > maxLength * 0.7) {
      return truncated.substring(0, lastSpace) + '...';
    }

    return truncated + '...';
  }
}
