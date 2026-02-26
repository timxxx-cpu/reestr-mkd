import React from 'react';
import { PassportStep } from '@/features/steps/passport';
import { CompositionStep } from '@/features/steps/composition';
import { RegistryNonresSelectorStep, RegistryNonresEditorStep } from '@/features/steps/registry-nonres';
import { BasementInventorySelectorStep, BasementInventoryEditorStep } from '@/features/steps/basement-inventory';
import { RegistryResSelectorStep, RegistryResEditorStep } from '@/features/steps/registry-res';
import { FloorsSelectorStep, FloorsEditorStep } from '@/features/steps/floors';
import { EntrancesSelectorStep, EntrancesEditorStep } from '@/features/steps/entrances';
import { ApartmentsSelectorStep, ApartmentsEditorStep } from '@/features/steps/apartments';
import { MopSelectorStep, MopEditorStep } from '@/features/steps/mop';
import { ParkingConfigStep } from '@/features/steps/parking-config';
import {
  RegistryApartmentsSelectorStep,
  RegistryApartmentsEditorStep,
} from '@/features/steps/registry-apartments';
import {
  RegistryCommercialSelectorStep,
  RegistryCommercialEditorStep,
} from '@/features/steps/registry-commercial';
import { RegistryParkingSelectorStep, RegistryParkingEditorStep } from '@/features/steps/registry-parking';
import { IntegrationBuildingsStep } from '@/features/steps/integration-buildings';
import { IntegrationUnitsStep } from '@/features/steps/integration-units';

const renderBuildingScopedStep = ({ SelectorComponent: _SelectorComponent, EditorComponent: _EditorComponent, mapEditorProps = () => ({}) }) => {
  const SelectorComponent = _SelectorComponent;
  const EditorComponent = _EditorComponent;
  return ({ projectId, editingBuildingId, setEditingBuildingId }) => {
    if (editingBuildingId) {
      return (
        <EditorComponent
          buildingId={editingBuildingId}
          onBack={() => setEditingBuildingId(null)}
          {...mapEditorProps({ projectId })}
        />
      );
    }

    return <SelectorComponent onSelect={setEditingBuildingId} />;
  };
};

const renderStaticStep = _StepComponent => {
  const StepComponent = _StepComponent;
  return () => <StepComponent />;
};

const STEP_REGISTRY = {
  passport: {
    render: renderStaticStep(PassportStep),
  },
  composition: {
    render: renderStaticStep(CompositionStep),
  },
  registry_nonres: {
    render: renderBuildingScopedStep({
      SelectorComponent: RegistryNonresSelectorStep,
      EditorComponent: RegistryNonresEditorStep,
    }),
  },
  basement_inventory: {
    render: renderBuildingScopedStep({
      SelectorComponent: BasementInventorySelectorStep,
      EditorComponent: BasementInventoryEditorStep,
    }),
  },
  registry_res: {
    render: renderBuildingScopedStep({
      SelectorComponent: RegistryResSelectorStep,
      EditorComponent: RegistryResEditorStep,
    }),
  },
  floors: {
    render: renderBuildingScopedStep({
      SelectorComponent: FloorsSelectorStep,
      EditorComponent: FloorsEditorStep,
    }),
  },
  entrances: {
    render: renderBuildingScopedStep({
      SelectorComponent: EntrancesSelectorStep,
      EditorComponent: EntrancesEditorStep,
    }),
  },
  apartments: {
    render: renderBuildingScopedStep({
      SelectorComponent: ApartmentsSelectorStep,
      EditorComponent: ApartmentsEditorStep,
    }),
  },
  mop: {
    render: renderBuildingScopedStep({
      SelectorComponent: MopSelectorStep,
      EditorComponent: MopEditorStep,
    }),
  },
  parking_config: {
    render: renderStaticStep(ParkingConfigStep),
  },
  registry_apartments: {
    render: renderBuildingScopedStep({
      SelectorComponent: RegistryApartmentsSelectorStep,
      EditorComponent: RegistryApartmentsEditorStep,
      mapEditorProps: ({ projectId }) => ({ projectId }),
    }),
  },
  registry_commercial: {
    render: renderBuildingScopedStep({
      SelectorComponent: RegistryCommercialSelectorStep,
      EditorComponent: RegistryCommercialEditorStep,
      mapEditorProps: ({ projectId }) => ({ projectId }),
    }),
  },
  registry_parking: {
    render: renderBuildingScopedStep({
      SelectorComponent: RegistryParkingSelectorStep,
      EditorComponent: RegistryParkingEditorStep,
      mapEditorProps: ({ projectId }) => ({ projectId }),
    }),
  },
  integration_buildings: {
    render: renderStaticStep(IntegrationBuildingsStep),
  },
  integration_units: {
    render: renderStaticStep(IntegrationUnitsStep),
  },
};

export const renderWorkflowStepContent = ({ stepId, projectId, editingBuildingId, setEditingBuildingId }) => {
  const entry = STEP_REGISTRY[stepId];
  if (!entry) {
    return <div className="p-8 text-center text-slate-400">Раздел в разработке</div>;
  }

  return entry.render({ projectId, editingBuildingId, setEditingBuildingId });
};

export const getWorkflowStepRegistry = () => STEP_REGISTRY;
