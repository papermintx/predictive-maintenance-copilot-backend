/**
 * Maintenance Graph Orchestrator
 * Executes the multi-step maintenance analysis workflow with routing logic
 * Supports both single-machine and multi-machine queries
 */

import { Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NestApiClient } from '../tools/nestApiClient';
import { GeminiLLM } from '../llm/gemini';
import type { MaintenanceGraphState } from './state';
import { IdentifyMachineNode } from './nodes/identifyMachine';
import { AnalyzeMachinesNode } from './nodes/analyzeMachines';
import { FetchSensorNode } from './nodes/fetchSensor';
import { FetchPredictionFromDBNode } from './nodes/fetchPredictionFromDB';
import { AnalyzeConditionNode } from './nodes/analyzeCondition';
import { GenerateAnswerNode } from './nodes/generateAnswer';

export class MaintenanceGraph {
  private readonly logger = new Logger(MaintenanceGraph.name);

  private identifyMachine: IdentifyMachineNode;
  private analyzeMachines: AnalyzeMachinesNode;
  private fetchSensor: FetchSensorNode;
  private fetchPredictionFromDB: FetchPredictionFromDBNode;
  private analyzeCondition: AnalyzeConditionNode;
  private generateAnswer: GenerateAnswerNode;

  private apiClient: NestApiClient;
  private llm: GeminiLLM;

  constructor(
    private prisma: PrismaService,
    private geminiApiKey: string,
  ) {
    this.initializeClients();
    this.initializeNodes();
  }

  private initializeClients() {
    this.apiClient = new NestApiClient(this.prisma);
    this.llm = new GeminiLLM(this.geminiApiKey);
  }

  private initializeNodes() {
    this.identifyMachine = new IdentifyMachineNode(this.apiClient, this.llm);
    this.analyzeMachines = new AnalyzeMachinesNode(this.apiClient);
    this.fetchSensor = new FetchSensorNode(this.apiClient);
    this.fetchPredictionFromDB = new FetchPredictionFromDBNode(this.apiClient);
    this.analyzeCondition = new AnalyzeConditionNode();
    this.generateAnswer = new GenerateAnswerNode(this.llm);
  }

  /**
   * Execute the graph for the given input
   * Routes to single-machine or multi-machine workflow based on query_type
   */
  async execute(input: {
    user_input: string;
    conversation_history?: Array<{ role: string; content: string }>;
    machine_id?: string;
  }): Promise<MaintenanceGraphState> {
    try {
      this.logger.log(
        `Executing graph with input: ${input.user_input.substring(0, 50)}...`,
      );

      let state: MaintenanceGraphState = {
        user_input: input.user_input,
        conversation_history: input.conversation_history || [],
        machine_id: input.machine_id,
        should_continue: true,
      };

      // Step 1: Identify Machine and detect query type
      this.logger.log('[Step 1] Identifying machine and query type...');
      state = {
        ...state,
        ...(await this.identifyMachine.execute(state)),
      };
      if (state.error) {
        this.logger.warn(`Identify machine error: ${state.error}`);
      }

      // Route based on query_type
      if (state.query_type === 'multi_machine') {
        return await this.executeMultiMachineWorkflow(state);
      } else {
        return await this.executeSingleMachineWorkflow(state);
      }
    } catch (error) {
      this.logger.error('Error executing graph:', error);
      throw new Error(`Graph execution failed: ${error}`);
    }
  }

  /**
   * Single-machine workflow (original flow)
   * Route: identify → fetch_sensor → fetch_predict → analyze → generate_answer
   */
  private async executeSingleMachineWorkflow(
    state: MaintenanceGraphState,
  ): Promise<MaintenanceGraphState> {
    this.logger.log('Executing single-machine workflow');

    // Check if clarification is needed
    if (state.needs_clarification) {
      this.logger.log('[CLARIFICATION] Returning clarification response');
      return {
        ...state,
        response:
          state.clarification_question ||
          'Saya perlu informasi lebih lanjut untuk membantu Anda.',
        should_continue: false,
      };
    }

    // Step 2: Fetch Sensor Data
    this.logger.log('[Step 2] Fetching sensor data...');
    state = {
      ...state,
      ...(await this.fetchSensor.execute(state)),
    };
    if (state.error) {
      this.logger.warn(`Fetch sensor error: ${state.error}`);
    }

    // Step 3: Fetch Prediction from Database
    this.logger.log('[Step 3] Fetching prediction from database...');
    state = {
      ...state,
      ...(await this.fetchPredictionFromDB.execute(state)),
    };
    if (state.error) {
      this.logger.warn(`Fetch prediction error: ${state.error}`);
    }

    // Step 4: Analyze Condition
    this.logger.log('[Step 4] Analyzing machine condition...');
    state = {
      ...state,
      ...(await this.analyzeCondition.execute(state)),
    };
    if (state.error) {
      this.logger.warn(`Analyze condition error: ${state.error}`);
    }

    // Step 5: Generate Answer
    this.logger.log('[Step 5] Generating answer...');
    state = {
      ...state,
      ...(await this.generateAnswer.execute(state)),
    };

    this.logger.log('Single-machine workflow completed');
    return state;
  }

  /**
   * Multi-machine workflow (new flow for aggregated queries)
   * Route: identify → analyze_machines → generate_answer
   */
  private async executeMultiMachineWorkflow(
    state: MaintenanceGraphState,
  ): Promise<MaintenanceGraphState> {
    this.logger.log('Executing multi-machine workflow');

    // Step 2: Analyze Machines (fetch list based on criteria)
    this.logger.log('[Step 2] Analyzing machines with criteria...');
    state = {
      ...state,
      ...(await this.analyzeMachines.execute(state)),
    };
    if (state.error) {
      this.logger.warn(`Analyze machines error: ${state.error}`);
    }

    // Step 3: Generate Answer (summarize multi-machine results)
    this.logger.log('[Step 3] Generating answer...');
    state = {
      ...state,
      ...(await this.generateAnswer.execute(state)),
    };

    this.logger.log('Multi-machine workflow completed');
    return state;
  }

  /**
   * Get graph structure for debugging
   */
  getGraphStructure() {
    return {
      nodes: [
        'identify_machine',
        'analyze_machines',
        'fetch_sensor',
        'fetch_prediction_from_db',
        'analyze_condition',
        'generate_answer',
      ],
      workflows: {
        single_machine: [
          'identify_machine',
          'fetch_sensor',
          'fetch_prediction_from_db',
          'analyze_condition',
          'generate_answer',
        ],
        multi_machine: [
          'identify_machine',
          'analyze_machines',
          'generate_answer',
        ],
      },
    };
  }
}
