import MopEditor from '@/features/steps/shared/MopEditor';
import {
  createBuildingEditorStep,
  createBuildingSelectorStep,
} from '@/features/steps/shared/step-entry-factories';

export const MopSelectorStep = createBuildingSelectorStep('mop');
export const MopEditorStep = createBuildingEditorStep(MopEditor, ({ buildingId, onBack }) => ({
  buildingId,
  onBack,
}));
