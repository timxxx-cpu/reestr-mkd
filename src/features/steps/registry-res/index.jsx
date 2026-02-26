import BuildingConfigurator from '@/features/steps/configurator';
import {
  createBuildingEditorStep,
  createBuildingSelectorStep,
} from '@/features/steps/shared/step-entry-factories';

export const RegistryResSelectorStep = createBuildingSelectorStep('registry_res');
export const RegistryResEditorStep = createBuildingEditorStep(
  BuildingConfigurator,
  ({ buildingId, onBack }) => ({ buildingId, mode: 'res', onBack })
);
