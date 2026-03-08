import React from 'react';
import BuildingSelector from '@/features/steps/shared/BuildingSelector';

const StepLoaderFallback = () => (
  <div className="flex min-h-[240px] items-center justify-center p-8 text-sm font-semibold text-slate-400">
    Загрузка раздела...
  </div>
);

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

export const createLazyStep = loadStep => {
  const LazyStep = React.lazy(loadStep);

  return function LazyStepEntry(props) {
    return (
      <React.Suspense fallback={<StepLoaderFallback />}>
        <LazyStep {...props} />
      </React.Suspense>
    );
  };
};

export const createLazyBuildingEditorStep = (loadEditor, mapProps = props => props) => {
  const LazyEditor = React.lazy(loadEditor);

  return function LazyBuildingEditorStep(props) {
    return (
      <React.Suspense fallback={<StepLoaderFallback />}>
        <LazyEditor {...mapProps(props)} />
      </React.Suspense>
    );
  };
};
