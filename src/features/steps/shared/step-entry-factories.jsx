import React from 'react';
import BuildingSelector from '@/features/steps/shared/BuildingSelector';

export const createBuildingSelectorStep = stepId => {
  return function BuildingSelectorStep({ onSelect }) {
    return <BuildingSelector stepId={stepId} onSelect={onSelect} />;
  };
};

export const createBuildingEditorStep = (EditorComponent, mapProps = props => props) => {
  return function BuildingEditorStep(props) {
    return <EditorComponent {...mapProps(props)} />;
  };
};
