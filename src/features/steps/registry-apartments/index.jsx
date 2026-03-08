import {
  createLazyBuildingEditorStep,
  createBuildingSelectorStep,
} from '@/features/steps/shared/step-entry-factories';

export const RegistryApartmentsSelectorStep = createBuildingSelectorStep('registry_apartments');
export const RegistryApartmentsEditorStep = createLazyBuildingEditorStep(
  () => import('@/features/steps/registry/views/ApartmentsRegistry'),
  ({ projectId, buildingId, onBack }) => ({ projectId, buildingId, onBack })
);
