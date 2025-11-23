/**
 * Fetch Prediction From DB Node
 * Retrieves latest prediction results from database (pre-computed by ML batch job)
 */

import { Logger } from '@nestjs/common';
import { NestApiClient } from '../../tools/nestApiClient';
import type { MaintenanceGraphState, PredictionData } from '../state';

export class FetchPredictionFromDBNode {
  private readonly logger = new Logger(FetchPredictionFromDBNode.name);

  constructor(private apiClient: NestApiClient) {}

  async execute(
    state: MaintenanceGraphState,
  ): Promise<Partial<MaintenanceGraphState>> {
    try {
      if (!state.machine_id) {
        this.logger.warn(
          '[FetchPrediction] No machine_id in state, skipping prediction fetch',
        );
        return {
          prediction_data: undefined,
          should_continue: true,
        };
      }

      this.logger.log(
        `[FetchPrediction] Fetching prediction from DB for machine: ${state.machine_id}`,
      );

      // ⭐ Query prediction_results table (pre-computed by ML batch job)
      const latestPrediction = await this.apiClient.getLatestPredictionFromDB(
        state.machine_id,
      );

      if (!latestPrediction) {
        this.logger.warn(
          `[FetchPrediction] ⚠️  No prediction found in DB for machine: ${state.machine_id}`,
        );
        return {
          prediction_data: undefined,
          should_continue: true,
        };
      }

      // ⭐ Map DB data to state
      const predictionData: PredictionData = {
        riskScore: latestPrediction.riskScore,
        failurePredicted: latestPrediction.failurePredicted,
        failureType: latestPrediction.failureType || undefined,
        confidence: latestPrediction.confidence || undefined,
        predictedFailureTime: latestPrediction.predictedFailureTime
          ? new Date(latestPrediction.predictedFailureTime)
          : undefined,
        timestamp: latestPrediction.timestamp,
      };

      this.logger.log(
        `[FetchPrediction] ✅ Fetched prediction for ${state.machine_id}: risk=${predictionData.riskScore.toFixed(3)}, failure=${predictionData.failurePredicted}`,
      );

      return {
        prediction_data: predictionData,
        should_continue: true,
      };
    } catch (error) {
      this.logger.error('Error fetching prediction from DB:', error);
      return {
        error: 'Failed to fetch prediction data',
        prediction_data: undefined,
        should_continue: true,
      };
    }
  }
}
