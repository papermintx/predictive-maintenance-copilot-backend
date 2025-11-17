/**
 * Analyze Condition Node
 * Analyzes sensor + prediction data to detect anomalies and generate insights
 */

import { Logger } from '@nestjs/common';
import type { MaintenanceGraphState, AnalysisResult } from '../state';

export class AnalyzeConditionNode {
  private readonly logger = new Logger(AnalyzeConditionNode.name);

  async execute(
    state: MaintenanceGraphState,
  ): Promise<Partial<MaintenanceGraphState>> {
    try {
      if (!state.machine_id) {
        this.logger.warn(
          '[AnalyzeCondition] No machine_id in state, skipping analysis',
        );
        return { should_continue: true };
      }

      this.logger.log(
        `[AnalyzeCondition] Analyzing condition for machine: ${state.machine_id}`,
      );
      this.logger.log(
        `[AnalyzeCondition] Data availability - Sensor: ${state.sensor_data ? state.sensor_data.length : 0} readings, Prediction: ${state.prediction_data ? 'YES' : 'NO'}`,
      );

      const alerts: string[] = [];
      const anomalies: string[] = [];
      const recommendations: string[] = [];

      // Determine base risk from prediction
      let riskScore = 0;
      if (state.prediction_data) {
        riskScore = state.prediction_data.riskScore;

        if (state.prediction_data.failurePredicted) {
          alerts.push(
            `⚠️ FAILURE PREDICTED: ${state.prediction_data.failureType || 'Unknown type'}`,
          );
          recommendations.push(
            `URGENT: Investigate predicted ${state.prediction_data.failureType} failure`,
          );
        }

        if (state.prediction_data.confidence) {
          const confidenceMsg = `Prediction confidence: ${(state.prediction_data.confidence * 100).toFixed(1)}%`;
          this.logger.log(confidenceMsg);
        }
      }

      // Analyze sensor data for anomalies
      if (state.sensor_data && state.sensor_data.length > 0) {
        const analysis = this.analyzeSensorTrends(state.sensor_data);

        if (analysis.temperatureAnomaly) {
          anomalies.push('❌ Temperature anomaly detected');
          alerts.push(
            `⚠️ Process temperature: ${analysis.avgProcessTemp?.toFixed(1)}K (abnormal)`,
          );
        }

        if (analysis.vibrationAnomaly) {
          anomalies.push('❌ Vibration/torque anomaly detected');
          alerts.push(`⚠️ Torque: ${analysis.avgTorque?.toFixed(1)}Nm (high)`);
        }

        if (analysis.toolWearHigh) {
          anomalies.push('❌ Tool wear approaching limit');
          alerts.push(
            `⚠️ Tool wear: ${analysis.avgToolWear?.toFixed(0)}min (high)`,
          );
          recommendations.push('Schedule tool replacement soon');
        }

        const sensorSummary = `
Sensor Status:
- Air Temperature: ${analysis.avgAirTemp?.toFixed(1)}K
- Process Temperature: ${analysis.avgProcessTemp?.toFixed(1)}K
- Rotational Speed: ${analysis.avgRotSpeed?.toFixed(0)} RPM
- Torque: ${analysis.avgTorque?.toFixed(1)} Nm
- Tool Wear: ${analysis.avgToolWear?.toFixed(0)} min
        `.trim();

        this.logger.log(sensorSummary);
      }

      // Determine overall risk level
      let riskLevel: 'LOW' | 'MODERATE' | 'HIGH' = 'LOW';
      if (riskScore >= 0.7 || alerts.length >= 2) {
        riskLevel = 'HIGH';
      } else if (riskScore >= 0.4 || alerts.length === 1) {
        riskLevel = 'MODERATE';
      }

      // Add general recommendations based on risk level
      if (riskLevel === 'HIGH') {
        recommendations.push('Schedule immediate maintenance inspection');
        recommendations.push(
          'Monitor machine continuously until maintenance is completed',
        );
      } else if (riskLevel === 'MODERATE') {
        recommendations.push(
          'Schedule preventative maintenance within 48 hours',
        );
        recommendations.push('Increase monitoring frequency');
      } else {
        recommendations.push('Continue normal operations');
        recommendations.push('Maintain regular monitoring schedule');
      }

      const analysis: AnalysisResult = {
        riskScore,
        riskLevel,
        summary: this.generateSummary(state.machine_context, riskLevel, alerts),
        alerts,
        recommendations,
        anomalies,
      };

      this.logger.log(
        `Analysis complete: risk_level=${riskLevel}, anomalies=${anomalies.length}`,
      );

      return {
        analysis,
        should_continue: true,
      };
    } catch (error) {
      this.logger.error('Error analyzing condition:', error);
      return {
        error: 'Failed to analyze machine condition',
        should_continue: true,
      };
    }
  }

  private analyzeSensorTrends(sensorData: any[]): {
    avgAirTemp?: number;
    avgProcessTemp?: number;
    avgRotSpeed?: number;
    avgTorque?: number;
    avgToolWear?: number;
    temperatureAnomaly: boolean;
    vibrationAnomaly: boolean;
    toolWearHigh: boolean;
  } {
    const n = sensorData.length;
    if (n === 0)
      return {
        temperatureAnomaly: false,
        vibrationAnomaly: false,
        toolWearHigh: false,
      };

    const avgAirTemp = sensorData.reduce((s, d) => s + d.airTemp, 0) / n;
    const avgProcessTemp =
      sensorData.reduce((s, d) => s + d.processTemp, 0) / n;
    const avgRotSpeed =
      sensorData.reduce((s, d) => s + d.rotationalSpeed, 0) / n;
    const avgTorque = sensorData.reduce((s, d) => s + d.torque, 0) / n;
    const avgToolWear = sensorData.reduce((s, d) => s + d.toolWear, 0) / n;

    const torqueThreshold = 50; // Nm
    const toolWearThreshold = 150; // min

    const temperatureAnomaly = avgProcessTemp > 310 || avgAirTemp > 30;
    const vibrationAnomaly = avgTorque > torqueThreshold;
    const toolWearHigh = avgToolWear > toolWearThreshold;

    return {
      avgAirTemp,
      avgProcessTemp,
      avgRotSpeed,
      avgTorque,
      avgToolWear,
      temperatureAnomaly,
      vibrationAnomaly,
      toolWearHigh,
    };
  }

  private generateSummary(
    machineContext: any,
    riskLevel: string,
    alerts: string[],
  ): string {
    let summary = `Machine ${machineContext?.productId || 'Unknown'} Status: **${riskLevel}**`;

    if (alerts.length > 0) {
      summary += `\n\n**Alerts:**\n${alerts.map((a) => `• ${a}`).join('\n')}`;
    }

    return summary;
  }
}
