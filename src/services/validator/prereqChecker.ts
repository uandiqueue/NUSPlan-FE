import { ModuleCode } from "../../types/shared/nusmods-types";

const matches = (p: string, c: string) =>
    p.includes('%') ? new RegExp('^' + p.replace('%', '.*') + '$').test(c) : p === c;

export function prereqSatisfied(
    picked: Set<ModuleCode>,
    rule: any,
): boolean {
    if (!rule) return true;
    if (typeof rule === 'string') return [...picked].some(c => matches(rule.split(':')[0], c));
    if ('and' in rule) return rule.and.every((n: any) => prereqSatisfied(picked, n));
    if ('or'  in rule) return rule.or.some((n: any) => prereqSatisfied(picked, n));
    // N_OF rules (milestone 3)
    return true;
}