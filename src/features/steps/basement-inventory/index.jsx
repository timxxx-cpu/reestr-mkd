import {
  createBuildingSelectorStep,
  createLazyBuildingEditorStep,
} from '@/features/steps/shared/step-entry-factories';

export const BasementInventorySelectorStep = createBuildingSelectorStep('basement_inventory');
export const BasementInventoryEditorStep = createLazyBuildingEditorStep(() => import('./BasementInventoryEditor'));
