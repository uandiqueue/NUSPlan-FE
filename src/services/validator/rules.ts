import { ModuleCode } from "../../types/shared/nusmods-types";

export function prereqSatisfied(code: ModuleCode, picked: Set<ModuleCode>, rule: any): boolean {
    if (!rule) return true;
    if (typeof rule === 'string') return picked.has(rule.replace(/:.*$/, ''));
    if ('and' in rule) return rule.and.every((n: any) => prereqSatisfied(code, picked, n));
    if ('or'  in rule) return rule.or.some((n: any) => prereqSatisfied(code, picked, n));
    // Skipping N_OF for now
    return true;
}

export function findPreclusion(picked: Set<ModuleCode>, list: ModuleCode[] = []): ModuleCode | null {
    return list.find(code => picked.has(code)) ?? null;
}