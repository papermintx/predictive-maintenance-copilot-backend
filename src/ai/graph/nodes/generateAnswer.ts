/**
 * Generate Answer Node
 * Uses LLM to generate final comprehensive response
 */

import { Logger } from '@nestjs/common';
import {
  HumanMessage,
  SystemMessage,
  AIMessage,
} from '@langchain/core/messages';
import { GeminiLLM } from '../../llm/gemini';
import type { MaintenanceGraphState } from '../state';

export class GenerateAnswerNode {
  private readonly logger = new Logger(GenerateAnswerNode.name);
  private llm: GeminiLLM;

  constructor(llm: GeminiLLM) {
    this.llm = llm;
  }

  async execute(
    state: MaintenanceGraphState,
  ): Promise<Partial<MaintenanceGraphState>> {
    try {
      this.logger.log('Generating answer...');

      // ⚠️ SAFETY CHECK: If no machine context or machine list, this should have been caught earlier
      if (
        !state.machine_context &&
        (!state.machine_list || state.machine_list.length === 0)
      ) {
        this.logger.error(
          'GenerateAnswer called without machine context or machine list! This indicates a flow bug.',
        );
        return {
          needs_clarification: true,
          clarification_question:
            'Saya perlu informasi spesifik tentang mesin yang Anda maksud. Bisa sebutkan product ID, nama, atau lokasi mesin?',
          should_continue: false,
        };
      }

      const analysisContext = this.buildAnalysisContext(state);
      const model = this.llm.getModel();
      const systemPrompt = this.llm.getSystemPrompt();

      const messages: any[] = [new SystemMessage(systemPrompt)];

      // Add conversation history (last 5 messages)
      if (state.conversation_history && state.conversation_history.length > 0) {
        for (const msg of state.conversation_history.slice(-5)) {
          if (msg.role === 'user') {
            messages.push(new HumanMessage(msg.content));
          } else if (msg.role === 'assistant') {
            messages.push(new AIMessage(msg.content));
          }
        }
      }

      // Add current analysis context
      messages.push(
        new HumanMessage(
          `User Query: ${state.user_input}\n\nAnalysis Context:\n${analysisContext}\n\nPlease provide a comprehensive response based on this analysis.`,
        ),
      );

      const response = await model.invoke(messages);
      const responseText = response.content as string;

      this.logger.log('LLM response generated successfully');

      // Parse structured response from text
      const structuredResponse = this.parseStructuredResponse(
        responseText,
        state.analysis,
        state.machine_context,
        state.sensor_data,
      );

      return {
        response: responseText,
        structured_response: structuredResponse,
        should_continue: false,
      };
    } catch (error) {
      this.logger.error('Error generating answer:', error);
      return {
        error: 'Failed to generate response',
        response: 'Unable to generate response. Please try again.',
        should_continue: false,
      };
    }
  }

  private buildAnalysisContext(state: MaintenanceGraphState): string {
    const parts: string[] = [];

    // Handle multi-machine scenario
    if (state.machine_list && state.machine_list.length > 0) {
      parts.push(`=== MULTI-MACHINE ANALYSIS ===`);
      parts.push(`Found ${state.machine_list.length} machines in database:`);
      for (const machine of state.machine_list) {
        parts.push(`\nMachine: ${machine.productId} (ID: ${machine.id})`);
        parts.push(`- Type: ${machine.type}`);
        parts.push(`- Location: ${machine.location || 'Unknown'}`);
        parts.push(`- Risk Level: ${machine.riskLevel}`);
        parts.push(`- Risk Score: ${machine.riskScore.toFixed(2)}`);

        if (machine.criticalAlerts && machine.criticalAlerts.length > 0) {
          parts.push(`- Critical Alerts: ${machine.criticalAlerts.join(', ')}`);
        }
      }
      parts.push(`\n=== END MACHINE DATA ===`);
      parts.push(
        `IMPORTANT: Use ONLY the machines listed above. Do NOT create fictional machines.`,
      );
    }
    // Handle single-machine scenario
    else if (state.machine_context) {
      parts.push(`Machine: ${state.machine_context.productId}`);
      parts.push(`Type: ${state.machine_context.type}`);
      parts.push(`Status: ${state.machine_context.status}`);

      // Add warning if data is missing
      if (!state.sensor_data || state.sensor_data.length === 0) {
        parts.push(
          `\nWARNING: No sensor data available for this machine in the database.`,
        );
      }
      if (!state.prediction_data) {
        parts.push(
          `\nWARNING: No prediction data available for this machine in the database.`,
        );
      }
    }

    if (state.analysis) {
      parts.push(`Risk Level: ${state.analysis.riskLevel}`);
      parts.push(`Risk Score: ${state.analysis.riskScore.toFixed(3)}`);

      if (state.analysis.alerts.length > 0) {
        parts.push(
          `Alerts:\n${state.analysis.alerts.map((a) => `- ${a}`).join('\n')}`,
        );
      }

      if (state.analysis.anomalies.length > 0) {
        parts.push(
          `Detected Anomalies:\n${state.analysis.anomalies.map((a) => `- ${a}`).join('\n')}`,
        );
      }

      if (state.analysis.recommendations.length > 0) {
        parts.push(
          `Preliminary Recommendations:\n${state.analysis.recommendations.map((r) => `- ${r}`).join('\n')}`,
        );
      }
    }

    if (state.sensor_data && state.sensor_data.length > 0) {
      const latest = state.sensor_data[state.sensor_data.length - 1];
      parts.push(`Latest Sensor Readings:
- Air Temp: ${latest.airTemp.toFixed(1)}K
- Process Temp: ${latest.processTemp.toFixed(1)}K
- Rotational Speed: ${latest.rotationalSpeed.toFixed(0)}RPM
- Torque: ${latest.torque.toFixed(1)}Nm
- Tool Wear: ${latest.toolWear.toFixed(0)}min`);
    }

    if (state.prediction_data) {
      const pred = state.prediction_data;
      parts.push(`Prediction Data:
- Failure Predicted: ${pred.failurePredicted ? 'YES' : 'NO'}
- Failure Type: ${pred.failureType || 'None'}
- Confidence: ${pred.confidence ? `${(pred.confidence * 100).toFixed(1)}%` : 'N/A'}`);
    }

    return parts.join('\n\n');
  }

  private parseStructuredResponse(
    text: string,
    analysis?: any,
    machineContext?: any,
    sensorData?: any[],
  ): any {
    const lines = text.split('\n');

    const nonEmptyLines = lines.filter((l) => l.trim().length > 0);
    const summary = nonEmptyLines[0] || text.substring(0, 200);

    const criticalAlerts = lines
      .filter(
        (l) =>
          l.toUpperCase().includes('ALERT') ||
          l.toUpperCase().includes('CRITICAL') ||
          l.toUpperCase().includes('WARNING'),
      )
      .slice(0, 5)
      .map((a) => a.trim())
      .filter((a) => a.length > 0);

    const recommendations = lines
      .filter(
        (l) =>
          l.toUpperCase().includes('RECOMMEND') ||
          l.toUpperCase().includes('ACTION') ||
          l.includes('Schedule'),
      )
      .slice(0, 5)
      .map((r) => r.trim())
      .filter((r) => r.length > 0);

    // Build machine analysis with real data from state
    const machineAnalysis = analysis
      ? [
          {
            machineId: machineContext?.machineId || 'unknown',
            productId: machineContext?.productId || 'unknown',
            type: machineContext?.type || 'unknown',
            status: machineContext?.status || 'unknown',
            location: machineContext?.location,
            riskScore: analysis.riskScore,
            riskLevel: analysis.riskLevel,
            failurePredicted: analysis.alerts.some((a: string) =>
              a.toUpperCase().includes('FAILURE'),
            ),
            recommendations: analysis.recommendations,
            latestMetrics: sensorData?.[sensorData.length - 1]
              ? {
                  airTemp: sensorData[sensorData.length - 1].airTemp,
                  processTemp: sensorData[sensorData.length - 1].processTemp,
                  rotationalSpeed:
                    sensorData[sensorData.length - 1].rotationalSpeed,
                  torque: sensorData[sensorData.length - 1].torque,
                  toolWear: sensorData[sensorData.length - 1].toolWear,
                }
              : undefined,
          },
        ]
      : [];

    return {
      summary,
      machineAnalysis,
      overallRisk: analysis?.riskLevel || 'MODERATE',
      criticalAlerts,
      recommendations,
    };
  }
}
