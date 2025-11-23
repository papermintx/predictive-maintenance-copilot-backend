import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...\n');

  // Get the 3 machines from the database
  const machines = await prisma.machine.findMany({
    where: {
      productId: {
        in: ['L47181', 'M14860', 'L47183', 'L47182'],
      },
    },
  });

  if (machines.length === 0) {
    console.log('⚠️  No machines found! Please create machines first.');
    console.log('   Machine IDs needed: L47181, M14860, L47183, L47182\n');
    return;
  }

  console.log(`✅ Found ${machines.length} machines:\n`);
  machines.forEach((m) => {
    console.log(`   - ${m.productId} (${m.type}) - ${m.name || 'No name'}`);
  });
  console.log();

  // Delete existing predictions
  const deletedCount = await prisma.predictionResult.deleteMany({
    where: {
      machineId: {
        in: machines.map((m) => m.id),
      },
    },
  });
  console.log(`🗑️  Deleted ${deletedCount.count} old predictions\n`);

  // Failure types based on predictive maintenance domain
  const failureTypes = [
    'Heat Dissipation Failure',
    'Power Failure',
    'Overstrain Failure',
    'Tool Wear Failure',
    'Random Failures',
  ];

  const predictions: {
    machineId: string;
    timestamp: Date;
    riskScore: number;
    failurePredicted: boolean;
    failureType: string | null;
    anomalyDetected: boolean;
    predictedFailureTime: Date | null;
    confidence: number;
  }[] = [];

  // Generate predictions for each machine
  for (const machine of machines) {
    console.log(`📊 Generating prediction for ${machine.productId}...`);

    // Generate 1 prediction per machine
    for (let i = 0; i < 1; i++) {
      const timestamp = new Date();
      timestamp.setHours(Math.floor(Math.random() * 24));
      timestamp.setMinutes(Math.floor(Math.random() * 60));

      // Machine type affects failure probability
      // L (Low) = more stable, M (Medium) = moderate, H (High) = more issues
      let baseRiskScore: number;
      let failureProbability: number;

      switch (machine.type) {
        case 'L':
          baseRiskScore = 0.15 + Math.random() * 0.3; // 0.15-0.45
          failureProbability = 0.15; // 15% chance of failure
          break;
        case 'M':
          baseRiskScore = 0.25 + Math.random() * 0.4; // 0.25-0.65
          failureProbability = 0.25; // 25% chance of failure
          break;
        case 'H':
          baseRiskScore = 0.4 + Math.random() * 0.45; // 0.4-0.85
          failureProbability = 0.35; // 35% chance of failure
          break;
        default:
          baseRiskScore = 0.3 + Math.random() * 0.3;
          failureProbability = 0.2;
      }

      // Add some variance for recent predictions (trending)
      const recencyFactor = 1; // Current prediction
      const trendVariance = (Math.random() - 0.5) * 0.15 * recencyFactor;
      const riskScore = Math.max(
        0.05,
        Math.min(0.95, baseRiskScore + trendVariance),
      );

      // Determine if failure is predicted
      const failurePredicted =
        riskScore > 0.7 || Math.random() < failureProbability;

      // Select failure type (weighted by risk)
      let failureType: string | null = null;
      if (failurePredicted) {
        if (riskScore > 0.8) {
          // High risk = more serious failures
          failureType =
            failureTypes[Math.floor(Math.random() * failureTypes.length)];
        } else if (riskScore > 0.6) {
          // Medium risk = tool wear or random
          failureType =
            Math.random() > 0.5 ? 'Tool Wear Failure' : 'Random Failures';
        } else {
          // Lower risk = mostly random
          failureType = 'Random Failures';
        }
      }

      // Anomaly detection (independent of failure prediction)
      const anomalyDetected = Math.random() < 0.1; // 10% chance

      // Predicted failure time (if failure predicted)
      let predictedFailureTime: Date | null = null;
      if (failurePredicted) {
        const hoursUntilFailure = Math.floor(
          riskScore > 0.8
            ? 6 + Math.random() * 18 // 6-24 hours
            : 24 + Math.random() * 72, // 1-4 days
        );
        predictedFailureTime = new Date(timestamp);
        predictedFailureTime.setHours(
          predictedFailureTime.getHours() + hoursUntilFailure,
        );
      }

      // Model confidence (higher for more data points)
      const confidence = 0.7 + Math.random() * 0.25; // 0.7-0.95

      predictions.push({
        machineId: machine.id,
        timestamp,
        riskScore: Math.round(riskScore * 1000) / 1000, // 3 decimal places
        failurePredicted,
        failureType,
        anomalyDetected,
        predictedFailureTime,
        confidence: Math.round(confidence * 1000) / 1000,
      });
    }

    console.log(`   ✅ Generated 1 prediction`);
  }

  console.log();

  // Insert all predictions
  const result = await prisma.predictionResult.createMany({
    data: predictions,
  });

  console.log(`\n✨ Successfully seeded ${result.count} predictions!\n`);

  // Print summary statistics
  console.log('📈 Summary Statistics:\n');

  for (const machine of machines) {
    const machinePredictions = predictions.filter(
      (p) => p.machineId === machine.id,
    );
    if (machinePredictions.length === 0) continue;

    const prediction = machinePredictions[0]; // Get the single prediction

    console.log(`   ${machine.productId} (${machine.type}):`);
    console.log(`   - Risk Score: ${prediction.riskScore}`);
    console.log(`   - Failure Predicted: ${prediction.failurePredicted}`);
    if (prediction.failureType) {
      console.log(`   - Failure Type: ${prediction.failureType}`);
    }
    console.log(`   - Confidence: ${prediction.confidence}`);
    console.log();
  }

  console.log('🎉 Seeding completed successfully!\n');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
