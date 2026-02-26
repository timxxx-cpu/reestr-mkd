import EntranceMatrixEditor from '@/features/steps/shared/EntranceMatrixEditor';
import {
  createBuildingEditorStep,
  createBuildingSelectorStep,
} from '@/features/steps/shared/step-entry-factories';

export const EntrancesSelectorStep = createBuildingSelectorStep('entrances');
export const EntrancesEditorStep = createBuildingEditorStep(EntranceMatrixEditor, ({ buildingId, onBack }) => ({
  buildingId,
  onBack,
}));
