import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import {
  SendMessageDto,
  ChatResponse,
  QueryChatMessagesDto,
  GetChatMessagesResponse,
} from './dto/chat.dto';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async sendMessage(
    @GetUser('id') userId: string,
    @Body() dto: SendMessageDto,
  ): Promise<ChatResponse> {
    return this.chatService.sendMessage(userId, dto);
  }

  @Get()
  async getChatMessages(
    @GetUser('id') userId: string,
    @Query() query: QueryChatMessagesDto,
  ): Promise<GetChatMessagesResponse> {
    return this.chatService.getChatMessages(userId, query);
  }
}
