import { Logger } from '@nestjs/common';
import { NestApiClient } from '../../tools/nestApiClient';
import { GeminiLLM } from '../../llm/gemini';
import type { MaintenanceGraphState } from '../state';

interface LLMParsed {
  isMultiMachineQuery: boolean;
  intent: string | null;
  compoundIntents: string[];
  machine: {
    productId?: string | null;
    name?: string | null;
    location?: string | null;
    type?: string | null;
  };
  timeWindow?: string | null;
  riskThreshold?: string | null;
  confidence: number;
}

export class IdentifyMachineNode {
  private readonly logger = new Logger(IdentifyMachineNode.name);

  constructor(
    private apiClient: NestApiClient,
    private llm: GeminiLLM,
  ) {}

  async execute(
    state: MaintenanceGraphState,
  ): Promise<Partial<MaintenanceGraphState>> {
    try {
      const input = state.user_input;
      this.logger.log(`LLM parsing: "${input}"`);

      /** 1) PARSING PURE LLM */
      const parsed = await this.llmParse(input);
      this.logger.log(`LLM parsed: ${JSON.stringify(parsed)}`);

      /** MULTI MACHINE */
      if (parsed.isMultiMachineQuery) {
        return {
          query_type: 'multi_machine',
          analysis_criteria: {
            criteriaType: (parsed.intent as any) || 'generic',
            timeWindow: parsed.timeWindow || undefined,
            riskThreshold: (parsed.riskThreshold as any) || undefined,
            compoundIntents: parsed.compoundIntents,
            // ⭐ Pass machine filters for multi-machine analysis
            machineFilters: {
              productId: parsed.machine.productId || undefined,
              name: parsed.machine.name || undefined,
              location: parsed.machine.location || undefined,
              type: (parsed.machine.type as 'L' | 'M' | 'H') || undefined,
            },
          },
          should_continue: true,
        };
      }

      /** SINGLE MACHINE */
      // No machine info → ask user
      this.logger.log(
        `[DEBUG] Checking clarification need: productId=${parsed.machine.productId}, name=${parsed.machine.name}, location=${parsed.machine.location}`,
      );
      if (
        !parsed.machine.productId &&
        !parsed.machine.name &&
        !parsed.machine.location
      ) {
        this.logger.log(
          `[DEBUG] CLARIFICATION TRIGGERED - No machine identifiers found`,
        );
        return {
          needs_clarification: true,
          clarification_question:
            'Saya bisa membantu menganalisis kondisi mesin. Apakah Anda ingin:\n\n' +
            '• Analisis untuk mesin tertentu? (sebutkan Product ID, nama, atau lokasi mesin)\n' +
            '• Analisis untuk semua mesin?\n' +
            '• Analisis untuk mesin dalam kategori tertentu? (misal: tipe L, M, H)',
          should_continue: false,
        };
      }

      this.logger.log(
        `[DEBUG] CLARIFICATION SKIPPED - At least one identifier found, proceeding to resolve machine`,
      );

      /** Resolve machine for single-machine query */
      const machines = await this.resolveMachine(parsed.machine);

      // Case: No machines found
      if (machines.length === 0) {
        return {
          needs_clarification: true,
          clarification_question:
            'Saya tidak menemukan mesin yang cocok. Bisa sebutkan product ID atau lokasi mesin?',
          should_continue: false,
        };
      }

      // Case: Exactly 1 machine found
      if (machines.length === 1) {
        const machine = machines[0];
        return {
          query_type: 'single_machine',
          machine_id: machine.id,
          machine_context: {
            machineId: machine.id,
            productId: machine.productId,
            name: machine.name,
            type: machine.type,
            status: machine.status,
            location: machine.location,
          },
          should_continue: true,
        };
      }

      // Case: Multiple machines found for single-machine query → ask for clarification
      if (machines.length > 1) {
        return {
          needs_clarification: true,
          candidate_machines: machines,
          clarification_question: `Saya menemukan ${machines.length} mesin. Mana yang Anda maksud?`,
          should_continue: false,
        };
      }

      // Fallback - should never reach here
      return {
        error: 'Unexpected state in machine identification',
        should_continue: false,
      };
    } catch (err) {
      this.logger.error(err);
      return {
        error: 'Gagal mengidentifikasi mesin.',
        should_continue: false,
      };
    }
  }

  /** 1) PURE LLM PARSER */
  private async llmParse(input: string): Promise<LLMParsed> {
    const prompt = `
Extract structured JSON from the user input. 
Strict JSON only. No Markdown.

Schema:
{
  "isMultiMachineQuery": boolean,
  "intent": "risk" | "prediction" | "anomaly" | "overheating" | "generic" | null,
  "compoundIntents": string[],
  "timeWindow": string | null,
  "riskThreshold": string | null,
  "machine": {
    "productId": string | null,
    "name": string | null,
    "location": string | null,
    "type": string | null
  },
  "confidence": number
}

User input:
"${input}"
`;

    const raw = await this.llm.getModel().invoke(prompt);

    const text = typeof raw.content === 'string' ? raw.content : raw.toString();

    // 🔧 Fix 1: JSON repair - remove markdown, clean up common LLM issues
    const cleanedText = text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .replace(/^[^{]*/, '') // Remove text before first {
      .replace(/[^}]*$/, '') // Remove text after last }
      .trim();

    let json: any;
    try {
      json = JSON.parse(cleanedText);
    } catch (error) {
      // Fallback: try to extract JSON object from anywhere in response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error(
          `Failed to parse LLM JSON response: ${(error as Error).message}`,
        );
      }
      json = JSON.parse(jsonMatch[0]);
    }

    return json as LLMParsed;
  }

  /** 2) Machine Resolver (DB fuzzy search + fast path) */
  private async resolveMachine(criteria: {
    productId?: string | null;
    name?: string | null;
    location?: string | null;
    type?: string | null;
  }): Promise<any[]> {
    this.logger.log(
      `[resolveMachine] Resolving with criteria: ${JSON.stringify(criteria)}`,
    );

    // 🔧 Fix 4: ProductId fast path (unique lookup)
    if (criteria.productId) {
      try {
        this.logger.log(
          `[resolveMachine] Trying fast path for productId: ${criteria.productId}`,
        );
        const machine = await this.apiClient.getMachine(criteria.productId);
        if (machine) {
          this.logger.log(
            `[resolveMachine] Fast path SUCCESS - Found: ${machine.productId}`,
          );
          return [machine];
        }
        this.logger.warn(
          `[resolveMachine] Fast path returned null, trying fuzzy search...`,
        );
      } catch (error) {
        this.logger.warn(
          `[resolveMachine] Fast path failed for productId ${criteria.productId}: ${(error as Error).message}`,
        );
        // Continue to fuzzy search if exact lookup fails
      }
    }

    // Build fuzzy search query
    const query: any = {};

    if (criteria.productId) query.productId = criteria.productId;
    if (criteria.name) query.name = criteria.name;
    if (criteria.location) query.location = criteria.location;
    // 🔧 Fix 2: Type normalization (handle lowercase LLM output)
    if (criteria.type) {
      const normalizedType = criteria.type.toUpperCase();
      if (['L', 'M', 'H'].includes(normalizedType)) {
        query.type = normalizedType;
      } else {
        // Handle descriptive types: "low" → "L", "medium" → "M", "high" → "H"
        const typeMap: { [key: string]: string } = {
          low: 'L',
          l: 'L',
          medium: 'M',
          mid: 'M',
          m: 'M',
          high: 'H',
          h: 'H',
        };
        const mappedType = typeMap[criteria.type.toLowerCase()];
        if (mappedType) query.type = mappedType;
      }
    }

    this.logger.log(
      `[resolveMachine] Fuzzy search query: ${JSON.stringify(query)}`,
    );
    const results = await this.apiClient.searchMachines(query);
    this.logger.log(
      `[resolveMachine] Fuzzy search found ${results?.length || 0} machines`,
    );
    return results ?? [];
  }
}
