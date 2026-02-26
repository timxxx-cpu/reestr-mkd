import BuildingConfigurator from '@/features/steps/configurator';
import {
  createBuildingEditorStep,
  createBuildingSelectorStep,
} from '@/features/steps/shared/step-entry-factories';

export const RegistryNonresSelectorStep = createBuildingSelectorStep('registry_nonres');
export const RegistryNonresEditorStep = createBuildingEditorStep(
  BuildingConfigurator,
  ({ buildingId, onBack }) => ({ buildingId, mode: 'nonres', onBack })
);
