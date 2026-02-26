import CommercialRegistry from '@/features/steps/registry/views/CommercialRegistry';
import {
  createBuildingEditorStep,
  createBuildingSelectorStep,
} from '@/features/steps/shared/step-entry-factories';

export const RegistryCommercialSelectorStep = createBuildingSelectorStep('registry_commercial');
export const RegistryCommercialEditorStep = createBuildingEditorStep(
  CommercialRegistry,
  ({ projectId, buildingId, onBack }) => ({ projectId, buildingId, onBack })
);
