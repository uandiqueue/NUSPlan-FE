import type { CourseBox } from '../types/shared/populator';
import RenderedExactBox from './RenderedExactBox';
import RenderedDropdownBox from './RenderedDropdownBox';
import RenderedAltPathBox from './RenderedAltPathBox';
import { usePlannerStore } from '../store/usePlannerStore';

function BoxRenderer({ box, requirementKey }: { box: CourseBox, requirementKey: string }) {

  // const chosen = usePlannerStore(state => state.chosen);
  // console.log("chosen: ", chosen); // DEBUG

  // Got the colours for each box from https://coolors.co/556dcc
  switch (box.kind) {
    case "exact":
      return <RenderedExactBox box={box} />

    case "dropdown":
      return <RenderedDropdownBox box={box} requirementKey={requirementKey} />

    case "altPath":
      return <RenderedAltPathBox box={box} requirementKey={requirementKey} />

    default:
      return <></>;
  }
}

export default BoxRenderer;