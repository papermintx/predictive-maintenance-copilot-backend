import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// ========================================
// Send Message DTO
// ========================================
export const sendMessageSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(1000),
});

export class SendMessageDto extends createZodDto(sendMessageSchema) {}

// ========================================
// Query Chat Messages DTO
// ========================================
export const queryChatMessagesSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50).optional(),
  offset: z.coerce.number().int().min(0).default(0).optional(),
});

export class QueryChatMessagesDto extends createZodDto(
  queryChatMessagesSchema,
) {}

// ========================================
// Response DTOs
// ========================================
export interface ChatMessageResponse {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

export interface ChatResponse {
  text: string;
  timestamp: Date;
  structuredData?: StructuredAiResponse;
}

export interface GetChatMessagesResponse {
  data: ChatMessageResponse[];
  meta: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// ========================================
// AI Response Structured Format
// ========================================
export interface MachineAnalysis {
  machineId: string;
  productId: string;
  type: string;
  status: string;
  location?: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH';
  failurePredicted: boolean;
  failureType?: string;
  confidence?: number;
  recommendations: string[];
  latestMetrics?: {
    airTemp?: number;
    processTemp?: number;
    rotationalSpeed?: number;
    torque?: number;
    toolWear?: number;
  };
}

export interface StructuredAiResponse {
  summary: string;
  machineAnalysis?: MachineAnalysis[];
  overallRisk: 'LOW' | 'MODERATE' | 'HIGH';
  criticalAlerts: string[];
  recommendations: string[];
}
