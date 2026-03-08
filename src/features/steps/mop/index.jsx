import {
  createLazyBuildingEditorStep,
  createBuildingSelectorStep,
} from '@/features/steps/shared/step-entry-factories';

export const MopSelectorStep = createBuildingSelectorStep('mop');
export const MopEditorStep = createLazyBuildingEditorStep(() => import('@/features/steps/shared/MopEditor'), ({ buildingId, onBack }) => ({
  buildingId,
  onBack,
}));
