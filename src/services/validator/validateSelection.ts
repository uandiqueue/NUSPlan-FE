import type { LookupTable, TagStripMap, Usage } from '../../types/feValidator';
import { ModuleCode } from '../../types/shared/nusmods-types';
import { exportJson } from '../tester';
import { buildDependencyMaps } from './dependencyMaps';
import { prereqSatisfied } from './prereqChecker';
import { prettify } from './prettyPrereq';

/* Validate every time selection changes */
export function validateSelection(
    picked: ModuleCode[],
    flat: LookupTable,
    fe2be: Record<string, string> // REDUNDANT past relics
) {
    //exportJson(flat, "lookuptable_for_validation"); // DEBUG
    //console.log(`Validating ${picked.join(', ')}`); // DEBUG
    const pickedSet = new Set(picked);
    const { prereqOf, precludeOf } = buildDependencyMaps(pickedSet, flat);
    const warnings: string[] = [];
    for (const code of picked) {
        const rule = flat.prereqs?.[code];
        if (!prereqSatisfied(pickedSet, rule)) {
            warnings.push(`${code} prerequisite: ${prettify(rule)}`);
            console.warn(warnings[warnings.length - 1]); // DEBUG
        }
    }

    // Block modules that clash (preclusions)
    const blocked = new Set<ModuleCode>();
    picked.forEach((code) => {
        (flat.preclusions[code] ?? []).forEach((clash) => {
            if (clash) {
                blocked.add(clash);
                //console.log(`Blocked ${clash} due to ${code}`); // DEBUG
            }
        });
        if ((flat.preclusions[code] ?? []).some(c => !c)) {
            console.warn(`${code} has undefined preclusions`); // In case of NUSMods lack of CourseInfo
        }
    });
    //console.log(`Blocked ${Array.from(blocked).join(', ')}`); // DEBUG

    // Max-rule tag stripping
    const strip: TagStripMap = {};
    const usage: Record<string, Usage> = {};
    //console.log(`Picked ${picked.join(', ')}`); // DEBUG
    picked.forEach((code) => {
        (flat.maxRequirements[code] ?? []).forEach((rule) => {
            const rec = (usage[rule.tag] ??= {
                used: 0,
                max: rule.maxUnits,
                rule,
                pickedCodes: [],
            });
            //console.log(`Max rule ${rule.tag} for ${code})`); // DEBUG
            //console.log(`Old usage: ${rec.used} for ${rule.tag}, max: ${rec.max}`); // DEBUG
            rec.used += flat.units[code] || 0;
            //console.log(`New usage: ${rec.used} for ${rule.tag}, max: ${rec.max}`); // DEBUG
            rec.pickedCodes.push(code);
            console.log(rec.pickedCodes); // DEBUG
        });
    });
    //console.log(`Usage of max rules: ${JSON.stringify(usage)}`); // DEBUG
    //exportJson(usage, "max_rules_usage"); // DEBUG
    Object.values(usage).forEach(({ 
        used, 
        max, 
        rule, 
        pickedCodes 
    }) => {
        //console.log(`usage: ${used} for ${rule.tag}, max: ${max}`); // DEBUG
        if (used > max) {
            let surplus = used - max;
            // Strip tags from latest picked courses
            for (let i = pickedCodes.length - 1; i >= 0 && surplus > 0; i--) {
                const code = pickedCodes[i];
                const mc = flat.units[code] || 0;
                const parentPrefix = rule.tag.replace(/-max_.*/, '');
                //console.log(`Parent prefix is ${parentPrefix} for ${code}`); // DEBUG

                // Collect all requirementKeys governed by this max rule
                const affectedKeys = Object.keys(flat.requiredUnits).filter(
                    k => k.startsWith(parentPrefix) && !k.includes('-max_')
                );
                // Strip these requirement tags from the course
                strip[code] = [ ...(strip[code] ?? []), ...affectedKeys ];
                blocked.add(code);
                surplus -= mc;
            }
            warnings.push(`Exceeded ${max} MC for ${rule.tag.replace(/_max.*/, '')}`);
        }
    });

    function progress(feKey: string) {
        const need = flat.requiredUnits[feKey] ?? 0;

        // Translate FE-BE (REDUNDANT past relics)
        const beKey = fe2be[feKey];
        if (!beKey) {
            console.warn(`No BE key found for FE key: ${feKey}`);
            return { have: 0, need: need, percent: 0 };
        }

        // Handle unrestricted electives
        if (feKey.endsWith('-unrestricted_electives')) {
            const allPicked = Array.from(pickedSet);
            const totalUnits = allPicked.reduce(
                (sum, code) => sum + (flat.units[code] || 0), 0
            );
            const isNotStripped = (code: string) => {
                const tags = strip[code] ?? [];
                return !tags.some(tag => tag === feKey || tag.startsWith(feKey + '-'));
            };
            const usedByOthers = new Set<string>();
            Object.keys(flat.requiredUnits).forEach(key => {
                if (key === feKey) return;
                const codes = flat.modulesByRequirement[feKey] ?? [];
                codes.forEach(code => {
                    if (pickedSet.has(code) && isNotStripped(code)) {
                        usedByOthers.add(code);
                    }
                });
            });
            let overflow = Math.max(0, totalUnits - 120);
            let ueUnits = 0;
            for (const code of allPicked) {
                if (usedByOthers.has(code)) continue;
                if (!isNotStripped(code)) continue;
                const mc = flat.units[code] || 0;
                if (overflow <= 0) break;
                const add = Math.min(mc, overflow);
                ueUnits += add;
                overflow -= add;
            }
            return { have: ueUnits, need, percent: need ? ueUnits / need : 1 };
        }

        const have = (flat.modulesByRequirement[beKey] ?? [])
            .filter((c) => pickedSet.has(c))
            .filter((c) =>
                !(strip[c]?.some(tag => tag === feKey || tag.startsWith(feKey + '-max_')))
            )
            .reduce((sum, c) => sum + (flat.units[c] || 0), 0);
        //console.log(`Progress for ${feKey}: need ${need}, have ${have}`); // DEBUG
        return { have, need, percent: need ? have / need : 1 };
    }
    return { warnings, blocked, stripped: strip, prereqOf, precludeOf, progress };
}