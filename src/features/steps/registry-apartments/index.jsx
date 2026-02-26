import ApartmentsRegistry from '@/features/steps/registry/views/ApartmentsRegistry';
import {
  createBuildingEditorStep,
  createBuildingSelectorStep,
} from '@/features/steps/shared/step-entry-factories';

export const RegistryApartmentsSelectorStep = createBuildingSelectorStep('registry_apartments');
export const RegistryApartmentsEditorStep = createBuildingEditorStep(
  ApartmentsRegistry,
  ({ projectId, buildingId, onBack }) => ({ projectId, buildingId, onBack })
);
