import {
  createLazyBuildingEditorStep,
  createBuildingSelectorStep,
} from '@/features/steps/shared/step-entry-factories';

export const ApartmentsSelectorStep = createBuildingSelectorStep('apartments');
export const ApartmentsEditorStep = createLazyBuildingEditorStep(() => import('@/features/steps/shared/FlatMatrixEditor'), ({ buildingId, onBack }) => ({
  buildingId,
  onBack,
}));
