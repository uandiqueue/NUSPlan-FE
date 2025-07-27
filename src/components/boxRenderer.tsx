// src/components/BoxRenderer.tsx
import type { CourseBox, PathInfo } from '../types/shared-types';
import EnhancedModuleSelector from './ModuleSelector';
import { usePlannerStore } from '../store/usePlannerStore';
import { ModuleCode } from '../types/nusmods-types';

interface BoxRendererProps {
  box: CourseBox;
  requirementKey: string;
  sectionPaths: PathInfo[];
  sectionBoxes: CourseBox[];
}

function BoxRenderer({
  box,
  requirementKey,
  sectionPaths,
  sectionBoxes,
}: BoxRendererProps) {
  const { programme } = usePlannerStore();

  return (
    <EnhancedModuleSelector
      courseBox={box}
      programmeId={programme.programmeId}
      sectionType={requirementKey}
      sectionPaths={sectionPaths}
      sectionBoxes={sectionBoxes}
    />
  );
}

export default BoxRenderer;
