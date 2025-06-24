// Pretty-print an NUSMods prereq tree
export function prettify(rule: any, wrap = false): string {
    if (!rule) return '';

    if (typeof rule === 'string') {
        return rule.split(':')[0]; // grade not included 
    }

    if ('and' in rule) {
        const inside = rule.and.map((r: any) => prettify(r, true)).join(' AND ');
        return wrap ? `(${inside})` : inside;
    }

    if ('or' in rule) {
        const inside = rule.or.map((r: any) => prettify(r, true)).join(' OR ');
        return wrap ? `(${inside})` : inside;
    }

    if ('nOf' in rule && Array.isArray(rule.nOf) && rule.nOf.length === 2) {
        const [n, arr] = rule.nOf;
        const inside = arr.map((r: any) => prettify(r, true)).join(', ');
        return `${n} of ${inside}`;
    }

    // Error case, should not happen
    return '…';
}
