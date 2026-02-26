import FloorMatrixEditor from '@/features/steps/shared/FloorMatrixEditor';
import {
  createBuildingEditorStep,
  createBuildingSelectorStep,
} from '@/features/steps/shared/step-entry-factories';

export const FloorsSelectorStep = createBuildingSelectorStep('floors');
export const FloorsEditorStep = createBuildingEditorStep(FloorMatrixEditor, ({ buildingId, onBack }) => ({
  buildingId,
  onBack,
}));
