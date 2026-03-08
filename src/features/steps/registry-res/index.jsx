import {
  createLazyBuildingEditorStep,
  createBuildingSelectorStep,
} from '@/features/steps/shared/step-entry-factories';

export const RegistryResSelectorStep = createBuildingSelectorStep('registry_res');
export const RegistryResEditorStep = createLazyBuildingEditorStep(
  () => import('@/features/steps/configurator'),
  ({ buildingId, onBack }) => ({ buildingId, mode: 'res', onBack })
);
