import type { CourseBox, PathInfo } from '../types/shared-types';
import ModuleSelector from './ModuleSelector';
import { usePlannerStore } from '../store/usePlannerStore';

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
  renderedBoxKeys = [],
}: BoxRendererProps & { renderedBoxKeys?: string[] }) {
  const { programme } = usePlannerStore();

  return (
    <ModuleSelector
      courseBox={box}
      programmeId={programme.programmeId}
      sectionType={requirementKey}
      sectionPaths={sectionPaths}
      sectionBoxes={sectionBoxes}
      renderedBoxKeys={renderedBoxKeys}
    />
  );
}

export default BoxRenderer;
