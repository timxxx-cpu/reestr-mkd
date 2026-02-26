import ParkingRegistry from '@/features/steps/registry/views/ParkingRegistry';
import {
  createBuildingEditorStep,
  createBuildingSelectorStep,
} from '@/features/steps/shared/step-entry-factories';

export const RegistryParkingSelectorStep = createBuildingSelectorStep('registry_parking');
export const RegistryParkingEditorStep = createBuildingEditorStep(
  ParkingRegistry,
  ({ projectId, buildingId, onBack }) => ({ projectId, buildingId, onBack })
);
