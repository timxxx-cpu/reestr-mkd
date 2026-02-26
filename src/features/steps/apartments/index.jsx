import FlatMatrixEditor from '@/features/steps/shared/FlatMatrixEditor';
import {
  createBuildingEditorStep,
  createBuildingSelectorStep,
} from '@/features/steps/shared/step-entry-factories';

export const ApartmentsSelectorStep = createBuildingSelectorStep('apartments');
export const ApartmentsEditorStep = createBuildingEditorStep(FlatMatrixEditor, ({ buildingId, onBack }) => ({
  buildingId,
  onBack,
}));
