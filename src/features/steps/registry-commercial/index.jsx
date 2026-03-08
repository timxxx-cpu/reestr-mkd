import {
  createLazyBuildingEditorStep,
  createBuildingSelectorStep,
} from '@/features/steps/shared/step-entry-factories';

export const RegistryCommercialSelectorStep = createBuildingSelectorStep('registry_commercial');
export const RegistryCommercialEditorStep = createLazyBuildingEditorStep(
  () => import('@/features/steps/registry/views/CommercialRegistry'),
  ({ projectId, buildingId, onBack }) => ({ projectId, buildingId, onBack })
);
