import {
  createLazyBuildingEditorStep,
  createBuildingSelectorStep,
} from '@/features/steps/shared/step-entry-factories';

export const RegistryNonresSelectorStep = createBuildingSelectorStep('registry_nonres');
export const RegistryNonresEditorStep = createLazyBuildingEditorStep(
  () => import('@/features/steps/configurator'),
  ({ buildingId, onBack }) => ({ buildingId, mode: 'nonres', onBack })
);
