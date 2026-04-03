import type { GuardResult } from '../../src/index.js';
import { formatUsd } from './formatUsd.js';

const printList = (label: string, values: string[]): void => {
  console.log(`${label}:`, values.length === 0 ? '[]' : values.join(', '));
};

export const printGuardResult = <TResult>(title: string, result: GuardResult<TResult>): void => {
  console.log(`\n=== ${title} ===`);
  console.log('runId:', result.runId);
  console.log('projectId:', result.context.project.id);
  console.log('providerId:', result.context.provider.id);
  console.log('model:', result.context.provider.model);
  console.log('maxTokens:', result.context.provider.maxTokens ?? 'n/a');

  console.log('decision.action:', result.decision.action);
  console.log('decision.allowed:', result.decision.allowed);
  console.log('decision.blocked:', result.decision.blocked);
  printList('checkedPolicies', result.decision.checkedPolicies);

  console.log('estimatedInputCostUsd:', formatUsd(result.preflight.estimatedInputCostUsd));
  console.log('estimatedWorstCaseCostUsd:', formatUsd(result.preflight.estimatedWorstCaseCostUsd));

  if (result.actualUsage !== undefined) {
    console.log('actual.inputTokens:', result.actualUsage.inputTokens);
    console.log('actual.outputTokens:', result.actualUsage.outputTokens);
    console.log('actual.totalTokens:', result.actualUsage.totalTokens);
    console.log('actual.inputCostUsd:', formatUsd(result.actualUsage.actualInputCostUsd));
    console.log('actual.outputCostUsd:', formatUsd(result.actualUsage.actualOutputCostUsd));
    console.log('actual.totalCostUsd:', formatUsd(result.actualUsage.actualTotalCostUsd));
  }

  if (result.violation !== undefined) {
    console.log('violation:');
    console.log(JSON.stringify(result.violation, null, 2));
  }

  if (result.appliedDowngrade !== undefined) {
    console.log('downgrade.originalModel:', result.appliedDowngrade.originalModel);
    console.log('downgrade.effectiveModel:', result.appliedDowngrade.effectiveModel);
    console.log('downgrade.originalMaxTokens:', result.appliedDowngrade.originalMaxTokens ?? 'n/a');
    console.log(
      'downgrade.effectiveMaxTokens:',
      result.appliedDowngrade.effectiveMaxTokens ?? 'n/a',
    );
  }

  if (result.costSpikeExplanation !== undefined) {
    console.log('costSpike.detected:', result.costSpikeExplanation.detected);
    console.log('costSpike.sampleCount:', result.costSpikeExplanation.sampleCount);
    console.log(
      'costSpike.currentActualTotalCostUsd:',
      formatUsd(result.costSpikeExplanation.currentActualTotalCostUsd),
    );
    console.log(
      'costSpike.baselineMedianActualTotalCostUsd:',
      formatUsd(result.costSpikeExplanation.baselineMedianActualTotalCostUsd),
    );
    console.log('costSpike.deltaUsd:', formatUsd(result.costSpikeExplanation.deltaUsd));

    if (result.costSpikeExplanation.topDrivers.length > 0) {
      console.log('costSpike.topDrivers:');
      for (const driver of result.costSpikeExplanation.topDrivers) {
        console.log(
          `- ${driver.label}: current=${driver.currentValue}, baseline=${driver.baselineValue}, delta=${driver.delta}`,
        );
      }
    }
  }

  if (result.result !== undefined) {
    console.log('result:');
    console.log(result.result);
  }
};
