import {
  createLazyBuildingEditorStep,
  createBuildingSelectorStep,
} from '@/features/steps/shared/step-entry-factories';

export const EntrancesSelectorStep = createBuildingSelectorStep('entrances');
export const EntrancesEditorStep = createLazyBuildingEditorStep(() => import('@/features/steps/shared/EntranceMatrixEditor'), ({ buildingId, onBack }) => ({
  buildingId,
  onBack,
}));
