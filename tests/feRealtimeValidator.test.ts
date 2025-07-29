import { RealtimeValidator } from '../src/services/feRealtimeValidator';
import { dbService } from '../src/services/dbQuery';
import type { ValidationState } from '../src/types/frontend-types';
import type { LookupMaps, ProgrammePayload } from '../src/types/shared-types';

// Mock the database
jest.mock('../src/config/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ single: jest.fn() }) })
    }),
    auth: {
      getUser: jest.fn(),
      signOut: jest.fn(),
    }
  }
}));

// Helper function to create blank state
const blankState = (): ValidationState => ({
  maxRuleFulfillment: new Map(),
  strippedTags: new Map(),
  doubleCountUsage: new Map(),
  doubleCountModules: new Map(),
  moduleUsageCount: new Map(),
  violatingModules: new Set(),
  selectedModules: new Set(),
  moduleToBoxMapping: new Map(),
});

const blankLookup: LookupMaps = {
  moduleToLeafPaths: {},
  leafPathToModules: {},
  moduleToMaxRules: {},
  doubleCountEligibility: {},
  pathHierarchy: {},
  pathIdToKey: {},
  pathKeyToId: {},
};

// Spy on FEDatabaseQueryService to mock return
const spy = <K extends keyof typeof dbService>(
  method: K,
  value: Awaited<ReturnType<(typeof dbService)[K]>> | (() => any)
) =>
  jest.spyOn(dbService, method)
    .mockResolvedValue(typeof value === 'function' ? value() : value);

afterEach(() => jest.restoreAllMocks());

describe('RealtimeValidator (simple)', () => {
  // Triple count check
  it('blocks a module already used twice', async () => {
    const state = blankState();
    state.moduleUsageCount.set('CS1231', 2);
    spy('getModuleAU', 4);
    spy('preloadModules', undefined);
    const rv = new RealtimeValidator(state, blankLookup, []);
    const res = await rv.validateSelection('CS1231', 'box-1');
    expect(res.isValid).toBe(false);
    expect(res.blockedReason).toBe('TRIPLE_COUNT_PREVENTED');
  });

  // Prerequisite check
  it('adds a prerequisite warning for a prerequisite', async () => {
    const state = blankState();
    spy('preloadModules', undefined);
    spy('getModuleAU', 4);
    spy('getModulePrerequisites', [
      {
        id: 'R1',
        module_code: 'CS2040S',
        rule_type: 'simple',
        rule_complexity: 'simple',
        depth: 1,
        required_modules: ['CS1010'],
        children: null,
        quantity_required: null,
        module_pattern: null,
        grade_required: null,
        original_text: 'CS1010 is a prerequisite for CS2040S',
        parent_rule_id: null,
      },
    ]);
    const rv = new RealtimeValidator(state, blankLookup, []);
    const res = await rv.validateSelection('CS2040S', 'box-1');
    expect(res.isValid).toBe(true);
    expect(res.warnings.some(w => w.includes('prerequisites'))).toBe(true);
  });

  // Max rule check
  it('strips tag and warns when AU cap is exceeded', async () => {
    const state = blankState();
    const lookup: LookupMaps = {
      ...blankLookup,
      moduleToMaxRules : { CS2040S: ['MAX1'] },
      leafPathToModules: { MAX1 : ['CS1010'] }, // another module in same context
    };
    spy('preloadModules', undefined);
    spy('getModuleAU', 5); // just for testing
    spy('getRequirementPathById', {
      id: 'MAX1', display_label: 'Level-2000 cap', rule_value: 4,
    } as any);
    spy('getModulePrerequisites', []);
    const rv  = new RealtimeValidator(state, lookup, []);
    const res = await rv.validateSelection('CS2040S', 'core-1');
    expect(res.warnings.some(w => w.includes('cap'))).toBe(true);
    expect(state.strippedTags.get('CS2040S')?.has('MAX1')).toBe(true);
  });

  // Double count check
  it('requires a double-count decision when eligible programmes > 1', async () => {
    const state = blankState();
    spy('getModuleAU', 4);
    spy('preloadModules', undefined);

    const lookup: LookupMaps = {
      ...blankLookup,
      doubleCountEligibility: {
        CS2040S: {
          crossProgrammeEligible: true,
          crossProgrammePaths: [],
          intraProgrammeEligible: false,
          intraProgrammePaths: [],
          allEligiblePaths: [],
          maxPossibleDoubleCount: 2,
          eligibleProgrammes: ['P1', 'P2'],
        },
      },
    };

    const programmes = [
      {
        programmeId: 'P1',
        metadata: {
          name: 'Programme 1',
          type: 'major',
          requiredUnits: 160,
          doubleCountCap: 8,
        },
        sections: [],
        preselectedModules: [],
      },
      {
        programmeId: 'P2',
        metadata: {
          name: 'Programme 2',
          type: 'major',
          requiredUnits: 160,
          doubleCountCap: 8,
        },
        sections: [],
        preselectedModules: [],
      },
    ] as ProgrammePayload[];

    const rv = new RealtimeValidator(state, lookup, programmes);
    const res = await rv.validateSelection('CS2040S', 'core-1');

    expect(res.isValid).toBe(true);
    expect(res.requiresDecision).toBe(true);
    expect(state.doubleCountModules.has('CS2040S')).toBe(true);
  });
});
