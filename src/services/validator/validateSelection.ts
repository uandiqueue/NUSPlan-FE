import type { LookupTable, TagStripMap, Usage } from '../../types/feValidator';
import { ModuleCode } from '../../types/shared/nusmods-types';
import { buildDependencyMaps } from './dependencyMaps';
import { prereqSatisfied } from './prereqChecker';
import { prettify } from './prettyPrereq';

/** Validate every time selection changes */
export function validateSelection(
    picked: ModuleCode[],
    flat: LookupTable,
    fe2be: Record<string, string>
) {
    const pickedSet = new Set(picked);

    // Prereq & preclusion dependency maps
    const { prereqOf, precludeOf } = buildDependencyMaps(pickedSet, flat);

    // Prerequisite warnings
    const warnings: string[] = [];
    for (const code of picked) {
        const rule = flat.prereqs?.[code];
        if (!prereqSatisfied(pickedSet, rule)) {
            warnings.push(`${code} prerequisite: ${prettify(rule)}`);
        }
    }

    // Block modules that clash (preclusions)
    const blocked = new Set<ModuleCode>();
    picked.forEach((code) => {
        (flat.preclusions[code] ?? []).forEach((clash) => blocked.add(clash));
    });

    // Max-rule tag stripping
    const strip: TagStripMap = {};
    const usage: Record<string, Usage> = {};

    picked.forEach((code) => {
        (flat.maxRequirements[code] ?? []).forEach((rule) => {
            const rec = (usage[rule.tag] ??= {
                used: 0,
                max: rule.maxUnits,
                rule,
            });
            rec.used += flat.units[code] || 0;
        });
    });

    Object.values(usage).forEach(({ used, max, rule }) => {
        if (used <= max) return;
        const parentReq = rule.tag.replace(/_max.*$/, "");
        rule.courses.forEach((code) => {
            if (pickedSet.has(code)) return;
            const toStrip = (flat.tags[code] ?? []).filter((t) =>
                t.startsWith(parentReq)
            );
            if (toStrip.length) strip[code] = [
                ...(strip[code] ?? []),
                ...toStrip,
            ];
        });
    });

    // Progress helper
    function progress(feKey: string) {
        // 1. units required (FE map) 
        const need = flat.requiredUnits[feKey] ?? 0;

        // 2. translate FE => BE once
        const beKey =
            fe2be[feKey] ??
            Object.keys(flat.modulesByRequirement).find((k) =>
                k.endsWith(`:${feKey}`)
            ) ??
            feKey;

        // 3. units already earned
        const have = (flat.modulesByRequirement[beKey] ?? [])
            .filter((c) => pickedSet.has(c))
            .filter((c) => !(strip[c]?.includes(feKey)))
            .reduce((sum, c) => sum + (flat.units[c] || 0), 0);

        console.log(`Progress for ${feKey}: need ${need}, have ${have}`); // DEBUG

        return { have, need, percent: need ? have / need : 1 };
    }

    return { warnings, blocked, stripped: strip, prereqOf, precludeOf, progress };
}