import { RequirementBlock as Block } from '../app/types/payload';
import { BoxRenderer } from './boxRenderer';
import { usePlanner } from '../hooks/usePlanner';

export function RequirementBlock({ block }: { block: Block }) {
  const { progress } = usePlanner();
  const earned = progress[block.requirementKey] ?? 0;

  return (
    <section className="mb-6">
      <h3 className="font-semibold">
        {block.label} — {earned}/{block.requiredUnits} MC
      </h3>

      <div className="mt-2 flex flex-col gap-2">
        {block.boxes.map((box) => (
          <BoxRenderer key={box.boxKey} box={box} />
        ))}
      </div>
    </section>
  );
}