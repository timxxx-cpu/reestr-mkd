import {
  createLazyBuildingEditorStep,
  createBuildingSelectorStep,
} from '@/features/steps/shared/step-entry-factories';

export const FloorsSelectorStep = createBuildingSelectorStep('floors');
export const FloorsEditorStep = createLazyBuildingEditorStep(() => import('@/features/steps/shared/FloorMatrixEditor'), ({ buildingId, onBack }) => ({
  buildingId,
  onBack,
}));
