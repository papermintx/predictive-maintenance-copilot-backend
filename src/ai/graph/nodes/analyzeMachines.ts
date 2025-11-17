/**
 * Analyze Machines Node
 * 
 * PURPOSE: Handle multi-machine queries efficiently
 * 
 * FLOW:
 * - User asks: "Mesin mana yang berisiko?"
 * - criteriaType detected: 'risk'
 * - Query database directly (no sensor fetching needed)
 * - Return filtered list
 
 * WHY DIFFERENT FROM SINGLE-MACHINE:
 * - Single-machine: need REAL-TIME detail (sensor + prediction)
 * - Multi-machine: only need RANKING/FILTERING
 
 * EXAMPLE CRITERIA:
 * - 'risk': Filter by risk_score > threshold
 * - 'prediction': Filter by failure_predicted = true
 * - 'anomaly': Filter by has_anomaly = true
 * - 'overheating': Filter by temp_anomaly in timeWindow
 */

import { Logger } from '@nestjs/common';
import { NestApiClient } from '../../tools/nestApiClient';
import type { MaintenanceGraphState } from '../state';

export class AnalyzeMachinesNode {
  private readonly logger = new Logger(AnalyzeMachinesNode.name);

  constructor(private apiClient: NestApiClient) {}

  async execute(
    state: MaintenanceGraphState,
  ): Promise<Partial<MaintenanceGraphState>> {
    try {
      if (!state.analysis_criteria) {
        return {
          error: 'No analysis criteria provided',
          should_continue: false,
        };
      }

      this.logger.log(
        `Analyzing machines for criteria: ${state.analysis_criteria.criteriaType}`,
      );

      let machineList: any[] = [];

      // Route to appropriate analysis method based on criteria type
      switch (state.analysis_criteria.criteriaType) {
        case 'risk':
          machineList = await this.getMachinesByRisk(
            state.analysis_criteria.timeWindow,
            state.analysis_criteria.riskThreshold,
          );
          break;

        case 'prediction':
          machineList = await this.getMachinesByPrediction(
            state.analysis_criteria.timeWindow,
          );
          break;

        case 'anomaly':
          machineList = await this.getMachinesByAnomaly();
          break;

        case 'overheating':
          machineList = await this.getMachinesByOverheating(
            state.analysis_criteria.timeWindow,
          );
          break;

        case 'generic':
        default:
          // Return all machines with their current status
          machineList = await this.getAllMachinesStatus();
          break;
      }

      if (!machineList || machineList.length === 0) {
        return {
          machine_list: [],
          response:
            'Tidak ada mesin yang cocok dengan kriteria pencarian Anda.',
          should_continue: true,
        };
      }

      this.logger.log(`Found ${machineList.length} machines matching criteria`);

      // Sort by risk score descending (highest risk first)
      machineList.sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0));

      return {
        machine_list: machineList,
        should_continue: true,
      };
    } catch (error) {
      this.logger.error('Error analyzing machines:', error);
      return {
        error: 'Gagal menganalisis mesin',
        should_continue: false,
      };
    }
  }

  private async getMachinesByRisk(
    timeWindow?: string,
    riskThreshold?: string,
  ): Promise<any[]> {
    try {
      return await this.apiClient.getMachinesByRisk(timeWindow, riskThreshold);
    } catch (error) {
      this.logger.error('Error fetching machines by risk:', error);
      return [];
    }
  }

  private async getMachinesByPrediction(timeWindow?: string): Promise<any[]> {
    try {
      return await this.apiClient.getMachinesByPrediction(timeWindow);
    } catch (error) {
      this.logger.error('Error fetching machines by prediction:', error);
      return [];
    }
  }

  private async getMachinesByAnomaly(): Promise<any[]> {
    try {
      return await this.apiClient.getMachinesByAnomaly();
    } catch (error) {
      this.logger.error('Error fetching machines by anomaly:', error);
      return [];
    }
  }

  private async getMachinesByOverheating(timeWindow?: string): Promise<any[]> {
    try {
      return await this.apiClient.getMachinesByOverheating(timeWindow);
    } catch (error) {
      this.logger.error('Error fetching machines by overheating:', error);
      return [];
    }
  }

  private async getAllMachinesStatus(): Promise<any[]> {
    try {
      return await this.apiClient.getAllMachinesStatus();
    } catch (error) {
      this.logger.error('Error fetching all machines status:', error);
      return [];
    }
  }
}
