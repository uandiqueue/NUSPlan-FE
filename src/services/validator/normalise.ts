/* 
Turn nested Requirement tree into flat lookup maps 
*/

import { ModuleCode } from "../../types/shared/nusmods-types";
import {
    PopulatedProgramPayload,
    CourseBox,
} from "../../types/shared/populator";
import {
    UnitMap,
    PrereqMap,
    PreclusionMap,
    TagMap
} from "../../types/shared/validator";
import {
    LookupTable,
    RequirementNodeInfo
} from "../../types/feValidator";

/* 
Normalise one or more programme payloads.
Never mutates the original payload objects, just reads them. 
*/
export function normalisePayload(
    payloads: PopulatedProgramPayload[]
): LookupTable {
    // Maps to return
    const requiredUnits: Record<string, number> = {};
    const modulesByRequirement: Record<string, ModuleCode[]> = {};
    const nodeInfo: Record<string, RequirementNodeInfo> = {};
    const requirementsByModule: TagMap = {};
    const units: UnitMap = {};
    const prereqs: PrereqMap = {};
    const preclusions: PreclusionMap = {};
    
    // Merge two arrays (uniquely) – used when the same module appears in more than one programme.
    const mergeArr = <T>(dest: T[] | undefined, src: T[]) =>
        Array.from(new Set([...(dest ?? []), ...src]));

    // Map moduleCode to requirementKey
    const linkModule = (key: string, code: ModuleCode) => {
        modulesByRequirement[key] ??= [];
        modulesByRequirement[key].push(code);
    };

    // Walk through the payloads and create the maps
    for (const payload of payloads) {
        const progId = payload.metadata.name ?? payload.metadata?.name ?? "programme";

    /* --------- merge programme-level lookup maps ---------------- */
    mergeMaps(units, payload.lookup.units);
    mergeMaps(prereqs, payload.lookup.prereqs);
    mergeMaps(preclusions, payload.lookup.preclusions);
    // `tags` (requirementsByModule) is rebuilt anyway, so we skip merge.

    /* --------- process requirement sections --------------------- */
    payload.requirements.forEach((section) => {
      const secKey = makeKey(progId, [section.group]);
      nodeInfo[secKey] = {
        logic: "SECTION",
        parent: null,
        children: [],
        selfKey: secKey,
        title: section.title ?? section.group,
      };
      requiredUnits[secKey] = section.requiredUnits ?? 0;

      for (const box of section.boxes) {
        traverseBox(box, [section.group], secKey);
      }
    });

    /* ---------- local recursion to handle CourseBox ------------- */
    function traverseBox(
      box: CourseBox,
      path: string[],
      parentKey: string
    ): void {
      switch (box.kind) {
        case "exact": {
          const key = makeKey(progId, [...path, box.course.courseCode]);
          attachNode(key, parentKey, "LEAF", box.course.courseCode);

          requiredUnits[key] = box.course.moduleCredit ?? 0;
          linkModule(key, box.course.courseCode);
          return;
        }

        case "dropdown": {
          const key = makeKey(progId, [...path, "dropdown"]);
          attachNode(
            key,
            parentKey,
            box.min === 1 ? "OR" : "N_OF",
            box.label ?? "Dropdown",
            box.min
          );
          requiredUnits[key] = box.requiredUnits ?? 0;

          box.options.forEach((opt) => {
            const cKey = makeKey(progId, [...path, opt.courseCode]);
            attachNode(cKey, key, "LEAF", opt.courseCode);
            requiredUnits[cKey] = opt.moduleCredit ?? 0;
            linkModule(cKey, opt.courseCode);
          });
          return;
        }

        case "altPath": {
          const key = makeKey(progId, [...path, "altPath"]);
          attachNode(key, parentKey, "OR", box.label ?? "AltPath");
          requiredUnits[key] = box.requiredUnits ?? 0;

          box.paths.forEach((p, idx) => {
            const pKey = makeKey(progId, [...path, `path${idx}`]);
            attachNode(pKey, key, "AND", `Path ${idx + 1}`);
            requiredUnits[pKey] = p.requiredUnits ?? 0;

            p.boxes.forEach((inner) =>
              traverseBox(inner, [...path, `path${idx}`], pKey)
            );
          });
          return;
        }
      }
    }

    /* small util to DRY node creation */
    function attachNode(
      key: string,
      parent: string | null,
      logic: RequirementNodeInfo["logic"],
      title: string,
      nOf?: number
    ) {
      nodeInfo[key] = {
        logic,
        parent,
        children: [],
        selfKey: key,
        title,
        ...(logic === "N_OF" && nOf ? { nOf } : {}),
      };
      if (parent) nodeInfo[parent].children.push(key);
    }
  }

  /* ----------------------------------------------------------------
   * 6️⃣  return final LookupTable
   * ---------------------------------------------------------------- */
  return {
    requiredUnits,
    modulesByRequirement,
    requirementsByModule,
    nodeInfo,
    units,
    prereqs,
    preclusions,
  };
}

/* ==================================================================
   🔸  helper: merge plain { [key]: value } maps  (no overwrite)
   ================================================================== */
function mergeMaps<T extends Record<string, unknown>>(
  dest: T,
  src: T | undefined
) {
  if (!src) return;
  for (const [k, v] of Object.entries(src)) {
    if (Array.isArray(v)) {
      // merge unique arrays
      dest[k] = Array.from(new Set([...(dest[k] as unknown as any[]) ?? [], ...v])) as any;
    } else if (typeof v === "object") {
      dest[k] = { ...(dest[k] ?? {}), ...v } as any;
    } else {
      dest[k] ??= v as any;
    }
  }
}