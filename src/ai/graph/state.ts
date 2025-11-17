/**
 * State definition for Maintenance Graph
 * Defines the structure of data that flows through the graph nodes
 */

export interface SensorDataPoint {
  airTemp: number;
  processTemp: number;
  rotationalSpeed: number;
  torque: number;
  toolWear: number;
  timestamp: Date;
}

export interface PredictionData {
  riskScore: number;
  failurePredicted: boolean;
  failureType?: string;
  confidence?: number;
  predictedFailureTime?: Date;
  timestamp: Date;
}

export interface MachineContext {
  machineId: string;
  productId: string;
  name?: string;
  type: string; // L, M, H
  status: string;
  location?: string;
}

export interface AnalysisResult {
  riskScore: number;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH';
  summary: string;
  alerts: string[];
  recommendations: string[];
  anomalies: string[];
}

export interface MaintenanceGraphState {
  // Input
  user_input: string;
  conversation_history: Array<{ role: string; content: string }>;

  // Query type detection
  query_type?: 'single_machine' | 'multi_machine'; // Determined by identifyMachine node
  analysis_criteria?: {
    criteriaType: 'risk' | 'prediction' | 'anomaly' | 'overheating' | 'generic';
    timeWindow?: string; // e.g., '1_day', '3_days', '1_week'
    riskThreshold?: 'high' | 'moderate' | 'low';
    predictionType?: string;
    compoundIntents?: string[]; // e.g., ['risk', 'overheating'] for compound queries
    // Machine filters for multi-machine queries (e.g., location: "Floor 1")
    machineFilters?: {
      productId?: string;
      name?: string;
      location?: string;
      type?: 'L' | 'M' | 'H'; // Match MachineType from Prisma schema
    };
  };

  // Single machine processing
  machine_id?: string;
  machine_context?: MachineContext;
  sensor_data?: SensorDataPoint[];
  prediction_data?: PredictionData;
  analysis?: AnalysisResult;

  // Multi machine processing
  machine_list?: Array<{
    id: string;
    productId: string;
    name?: string;
    type: string;
    location?: string;
    riskScore: number;
    riskLevel: 'LOW' | 'MODERATE' | 'HIGH';
    criticalAlerts?: string[];
  }>;

  // Output
  response?: string;
  structured_response?: {
    summary: string;
    machineAnalysis: any[];
    overallRisk?: 'LOW' | 'MODERATE' | 'HIGH';
    criticalAlerts: string[];
    recommendations: string[];
  };

  // Clarification
  needs_clarification?: boolean;
  clarification_question?: string;
  candidate_machines?: any[];

  // Metadata
  error?: string;
  should_continue: boolean;
}
