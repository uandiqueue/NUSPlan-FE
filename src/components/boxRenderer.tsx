import { usePlanner } from '../hooks/usePlanner';
import type { Box, Course } from '../app/types/payload';

export function BoxRenderer({ box }: { box: Box }) {
  const { chosen, toggle, canPick } = usePlanner();
  const isPicked = (c: Course) =>
    chosen.some((sel) => sel.courseCode === c.courseCode);

  switch (box.kind) {
    case 'exact': {
      const disabled = !canPick(box.course);
      return (
        <label
          className="flex items-center gap-2"
          style={{ opacity: disabled ? 0.5 : 1 }}
        >
          <input
            type="checkbox"
            checked={isPicked(box.course)}
            disabled={disabled}
            onChange={() => toggle(box.course)}
          />
          {box.UILabel}
        </label>
      );
    }

    case 'dropdown': {
      const groupCodes = box.options.map((o) => o.courseCode);

      const disabledCodes = new Set(
        box.options.filter((o) => !canPick(o)).map((o) => o.courseCode)
      );
      const selected = box.options.find(isPicked);

      return (
        <select
          value={selected?.courseCode ?? ''}
          onChange={(e) => {
            const opt = box.options.find(
              (o) => o.courseCode === e.target.value
            );
            if (opt) {
              toggle(opt, groupCodes);
            }
          }}
        >
          <option value="">Choose…</option>
          {box.options.map((o) => (
            <option
              key={o.courseCode}
              value={o.courseCode}
              disabled={disabledCodes.has(o.courseCode)}
            >
              {o.courseCode} – {o.title}
            </option>
          ))}
        </select>
      );
    }

    case 'altPath':
      return (
        <details>
          <summary>{box.UILabel}</summary>
          {box.paths.map((p) => (
            <div key={p.id} style={{ marginLeft: 12 }}>
              {p.boxes.map((b) => (
                <BoxRenderer key={b.boxKey} box={b} />
              ))}
            </div>
          ))}
        </details>
      );
  }
}
