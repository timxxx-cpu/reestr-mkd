import BasementInventoryEditor from './BasementInventoryEditor';
import { createBuildingEditorStep, createBuildingSelectorStep } from '@/features/steps/shared/step-entry-factories';

export const BasementInventorySelectorStep = createBuildingSelectorStep('basement_inventory');
export const BasementInventoryEditorStep = createBuildingEditorStep(BasementInventoryEditor);
