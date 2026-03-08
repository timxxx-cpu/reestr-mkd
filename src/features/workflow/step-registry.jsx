import React from 'react';

const lazyNamedExport = (loadModule, exportName) =>
  React.lazy(() =>
    loadModule().then(module => ({
      default: module[exportName],
    }))
  );

const PassportStep = lazyNamedExport(() => import('@/features/steps/passport'), 'PassportStep');
const CompositionStep = lazyNamedExport(() => import('@/features/steps/composition'), 'CompositionStep');
const RegistryNonresSelectorStep = lazyNamedExport(
  () => import('@/features/steps/registry-nonres'),
  'RegistryNonresSelectorStep'
);
const RegistryNonresEditorStep = lazyNamedExport(
  () => import('@/features/steps/registry-nonres'),
  'RegistryNonresEditorStep'
);
const BasementInventorySelectorStep = lazyNamedExport(
  () => import('@/features/steps/basement-inventory'),
  'BasementInventorySelectorStep'
);
const BasementInventoryEditorStep = lazyNamedExport(
  () => import('@/features/steps/basement-inventory'),
  'BasementInventoryEditorStep'
);
const RegistryResSelectorStep = lazyNamedExport(
  () => import('@/features/steps/registry-res'),
  'RegistryResSelectorStep'
);
const RegistryResEditorStep = lazyNamedExport(
  () => import('@/features/steps/registry-res'),
  'RegistryResEditorStep'
);
const FloorsSelectorStep = lazyNamedExport(() => import('@/features/steps/floors'), 'FloorsSelectorStep');
const FloorsEditorStep = lazyNamedExport(() => import('@/features/steps/floors'), 'FloorsEditorStep');
const EntrancesSelectorStep = lazyNamedExport(
  () => import('@/features/steps/entrances'),
  'EntrancesSelectorStep'
);
const EntrancesEditorStep = lazyNamedExport(
  () => import('@/features/steps/entrances'),
  'EntrancesEditorStep'
);
const ApartmentsSelectorStep = lazyNamedExport(
  () => import('@/features/steps/apartments'),
  'ApartmentsSelectorStep'
);
const ApartmentsEditorStep = lazyNamedExport(
  () => import('@/features/steps/apartments'),
  'ApartmentsEditorStep'
);
const MopSelectorStep = lazyNamedExport(() => import('@/features/steps/mop'), 'MopSelectorStep');
const MopEditorStep = lazyNamedExport(() => import('@/features/steps/mop'), 'MopEditorStep');
const ParkingConfigStep = lazyNamedExport(
  () => import('@/features/steps/parking-config'),
  'ParkingConfigStep'
);
const RegistryApartmentsSelectorStep = lazyNamedExport(
  () => import('@/features/steps/registry-apartments'),
  'RegistryApartmentsSelectorStep'
);
const RegistryApartmentsEditorStep = lazyNamedExport(
  () => import('@/features/steps/registry-apartments'),
  'RegistryApartmentsEditorStep'
);
const RegistryCommercialSelectorStep = lazyNamedExport(
  () => import('@/features/steps/registry-commercial'),
  'RegistryCommercialSelectorStep'
);
const RegistryCommercialEditorStep = lazyNamedExport(
  () => import('@/features/steps/registry-commercial'),
  'RegistryCommercialEditorStep'
);
const RegistryParkingSelectorStep = lazyNamedExport(
  () => import('@/features/steps/registry-parking'),
  'RegistryParkingSelectorStep'
);
const RegistryParkingEditorStep = lazyNamedExport(
  () => import('@/features/steps/registry-parking'),
  'RegistryParkingEditorStep'
);
const IntegrationBuildingsStep = lazyNamedExport(
  () => import('@/features/steps/integration-buildings'),
  'IntegrationBuildingsStep'
);
const IntegrationUnitsStep = lazyNamedExport(
  () => import('@/features/steps/integration-units'),
  'IntegrationUnitsStep'
);

const renderBuildingScopedStep = ({
  SelectorComponent: _SelectorComponent,
  EditorComponent: _EditorComponent,
  mapEditorProps = () => ({}),
}) => {
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
    return <div className="p-8 text-center text-slate-400">Р Р°Р·РґРµР» РІ СЂР°Р·СЂР°Р±РѕС‚РєРµ</div>;
  }

  return entry.render({ projectId, editingBuildingId, setEditingBuildingId });
};

export const getWorkflowStepRegistry = () => STEP_REGISTRY;
