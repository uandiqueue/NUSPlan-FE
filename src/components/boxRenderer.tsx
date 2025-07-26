import type { CourseBox } from '../types/shared-types';
import EnhancedModuleSelector from './ModuleSelector';
import { usePlannerStore } from '../store/usePlannerStore';

function BoxRenderer({
  box,
  requirementKey
}: {
  box: CourseBox;
  requirementKey: string;
}) {
  const { programme } = usePlannerStore();

  return (
    <EnhancedModuleSelector
      courseBox={box}
      programmeId={programme.programmeId}
      sectionType={requirementKey}
    />
  );
}

export default BoxRenderer