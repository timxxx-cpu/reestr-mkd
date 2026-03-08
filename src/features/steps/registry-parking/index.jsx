import {
  createLazyBuildingEditorStep,
  createBuildingSelectorStep,
} from '@/features/steps/shared/step-entry-factories';

export const RegistryParkingSelectorStep = createBuildingSelectorStep('registry_parking');
export const RegistryParkingEditorStep = createLazyBuildingEditorStep(
  () => import('@/features/steps/registry/views/ParkingRegistry'),
  ({ projectId, buildingId, onBack }) => ({ projectId, buildingId, onBack })
);
