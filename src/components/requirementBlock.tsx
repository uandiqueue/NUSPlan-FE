import type { RequirementSection } from '../types/shared/populator';
import { BoxRenderer } from './boxRenderer';
import { usePlanner } from '../hooks/usePlanner';

// Renders a single UI section block (“Core Electives” etc.)
export function RequirementBlock({ block }: { block: RequirementSection }) {
  // Read helpers from context
  const { progress } = usePlanner();

  // Call progress helper (function, not map)
  const { have, need } = progress(block.requirementKey);

  return (
    <section className="mb-6">
      <h3 className="font-semibold">
        {block.label} — {have}/{need} MC
      </h3>

      <div className="mt-2 flex flex-col gap-2">
        {block.boxes.map(b => (
          <BoxRenderer key={b.boxKey} box={b} />
        ))}
      </div>
    </section>
  );
}
