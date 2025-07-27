import type { LookupMaps, LeafPathMapping, ProgrammePayload } from '../types/shared-types';
import type { ModuleCode } from '../types/nusmods-types';
import type { RealtimeValidator } from './feRealtimeValidator';
import type { ModuleTag, TagLabel, DecisionOption, PendingDecision } from '../types/frontend-types';
import { dbService } from './dbQuery';

export class Optimizer {
  private validator: RealtimeValidator;
  private lookupMaps: LookupMaps;
  private programmes: ProgrammePayload[];

  // Cache for module AU values to improve UI performance
  private moduleAUCache = new Map<ModuleCode, number>();

  constructor(validator: RealtimeValidator, lookupMaps: LookupMaps, programmes: ProgrammePayload[]) {
    this.validator = validator;
    this.lookupMaps = lookupMaps;
    this.programmes = programmes;
  }

  /**
   * Generate module tags with proper dulling based on validator state
   */
  async generateModuleTags(module: ModuleCode): Promise<ModuleTag[]> {
    const tags: ModuleTag[] = [];

    // Generate R tags (requirement fulfillment)
    const rTag = await this.generateRequirementTag(module);
    if (rTag.labels.length > 0) {
      tags.push(rTag);
    }

    // Generate D tags (double-count opportunities)
    const dTag = await this.generateDoubleCountTag(module);
    if (dTag.labels.length > 0) {
      tags.push(dTag);
    }

    return tags;
  }

  /**
   * Generate R tags showing LEAF path names
   */
  private async generateRequirementTag(module: ModuleCode): Promise<ModuleTag> {
    const leafPaths = this.lookupMaps.moduleToLeafPaths[module] || [];
    const labels: TagLabel[] = [];
    const strippedTags = this.validator.getStrippedTags().get(module) || new Set();

    leafPaths.forEach(path => {
      const isDulled = strippedTags.has(path.pathKey);
      const isMaxCap = this.isPathAtMaxCap(path.pathKey);

      labels.push({
        text: path.displayLabel,
        pathKey: path.pathKey,
        isDulled,
        isHighlighted: isMaxCap,
        context: `${path.groupType} - ${path.requiredUnits} AU required`
      });
    });

    return {
      type: 'R',
      labels,
      isVisible: labels.length > 0,
      isFaded: labels.every(label => label.isDulled)
    };
  }

  /**
   * Generate D tags showing section-level programme paths
   */
  private async generateDoubleCountTag(module: ModuleCode): Promise<ModuleTag> {
    const doubleCountInfo = this.lookupMaps.doubleCountEligibility[module];
    if (!doubleCountInfo || doubleCountInfo.maxPossibleDoubleCount === 0) {
      return { type: 'D', labels: [], isVisible: false, isFaded: false };
    }

    const labels: TagLabel[] = [];
    const doubleCountUsage = this.validator.getDoubleCountUsage();

    doubleCountInfo.eligibleProgrammes.forEach(programmeId => {
      const programme = this.getProgramme(programmeId);
      if (!programme) return;

      const relevantPaths = doubleCountInfo.allEligiblePaths.filter(
        path => path.programmeId === programmeId
      );

      if (relevantPaths.length === 0) return;

      // Get unique group types for this programme
      const groupTypes = [...new Set(relevantPaths.map(p => p.groupType))];
      const section = groupTypes.join(' & ');

      const currentUsage = doubleCountUsage.get(programmeId) || 0;
      const isDulled = currentUsage >= programme.metadata.doubleCountCap;

      labels.push({
        text: `${programme.metadata.name} -- ${section}`,
        programmeId,
        isDulled,
        isHighlighted: false,
        context: `Double-count opportunity (${currentUsage}/${programme.metadata.doubleCountCap} AU used)`
      });
    });

    return {
      type: 'D',
      labels,
      isVisible: labels.length > 0,
      isFaded: labels.every(label => label.isDulled)
    };
  }

  /**
   * Check if a module should be disabled in dropdowns
   */
  isModuleDisabled(module: ModuleCode): boolean {
    const violatingModules = this.validator.getViolatingModules();
    return violatingModules.has(module);
  }

  /**
   * Create decision dialog for double-count allocation
   */
  async createDoubleCountDecision(module: ModuleCode, boxKey: string): Promise<PendingDecision | null> {
    const doubleCountInfo = this.lookupMaps.doubleCountEligibility[module];
    if (!doubleCountInfo || doubleCountInfo.maxPossibleDoubleCount === 0) return null;

    const doubleCountUsage = this.validator.getDoubleCountUsage();
    const moduleAU = await this.getModuleAU(module);
    const eligibleProgrammes = doubleCountInfo.eligibleProgrammes;

    // Filter programmes that can still accept this module
    const availableOptions: DecisionOption[] = [];

    eligibleProgrammes.forEach(programmeId => {
      const programme = this.getProgramme(programmeId);
      if (!programme) return;

      const currentUsage = doubleCountUsage.get(programmeId) || 0;
      const maxCapacity = programme.metadata.doubleCountCap;

      if (currentUsage + moduleAU <= maxCapacity) {
        const relevantPaths = doubleCountInfo.allEligiblePaths.filter(
          path => path.programmeId === programmeId
        );
        const groupTypes = [...new Set(relevantPaths.map(p => p.groupType))];

        availableOptions.push({
          id: programmeId,
          label: programme.metadata.name,
          description: groupTypes.join(' & '),
          currentUsage,
          maxCapacity,
          utilizationRate: maxCapacity > 0 ? currentUsage / maxCapacity : 0
        });
      }
    });

    if (availableOptions.length <= 1) return null;

    return {
      module,
      boxKey,
      type: 'DOUBLE_COUNT_CHOICE',
      options: availableOptions,
      maxSelections: Math.min(2, availableOptions.length),
      title: `Choose programmes for ${module}`,
      message: `This module can count toward multiple programmes. Select up to 2:`
    };
  }

  /**
   * Get box styling based on validation state
   */
  async getBoxStyling(module: ModuleCode, boxKey: string): Promise<{
    borderColor: string;
    backgroundColor: string;
    isDisabled: boolean;
    showWarning: boolean;
  }> {
    const isDisabled = this.isModuleDisabled(module);
    const tags = await this.generateModuleTags(module);
    const hasStrippedTags = tags.some(tag => tag.labels.some(label => label.isDulled));
    const hasMaxCapWarning = tags.some(tag => tag.labels.some(label => label.isHighlighted));

    return {
      borderColor: isDisabled ? '#ccc' : hasMaxCapWarning ? '#f44336' : '#1976d2',
      backgroundColor: isDisabled ? '#f5f5f5' : hasStrippedTags ? '#fff3e0' : '#ffffff',
      isDisabled,
      showWarning: hasMaxCapWarning || hasStrippedTags
    };
  }

  /**
   * Get dropdown options with proper filtering
   */
  async getFilteredDropdownOptions(boxOptions: ModuleCode[]): Promise<{
    module: ModuleCode;
    isDisabled: boolean;
    tags: ModuleTag[];
    warnings: string[];
    moduleInfo?: {
      title: string;
      description?: string;
      department?: string;
      au: number;
    };
  }[]> {
    // Batch fetch module details for better performance
    const moduleDetails = await dbService.getModulesDetails(boxOptions);
    const moduleDetailsMap = new Map(moduleDetails.map(mod => [mod.module_code, mod]));

    const results = await Promise.all(
      boxOptions.map(async module => {
        const isDisabled = this.isModuleDisabled(module);
        const tags = await this.generateModuleTags(module);
        const warnings = await this.getModuleWarnings(module);
        const moduleData = moduleDetailsMap.get(module);

        return {
          module,
          isDisabled,
          tags,
          warnings,
          moduleInfo: moduleData ? {
            title: moduleData.title,
            description: moduleData.description,
            department: moduleData.department,
            au: Number(moduleData.module_credit)
          } : undefined
        };
      })
    );

    return results;
  }

  /**
   * Get warnings for a specific module
   */
  private async getModuleWarnings(module: ModuleCode): Promise<string[]> {
    const warnings: string[] = [];
    const strippedTags = this.validator.getStrippedTags().get(module) || new Set();

    if (strippedTags.size > 0) {
      warnings.push(`Some requirements will not be fulfilled due to max caps`);
    }

    const violatingModules = this.validator.getViolatingModules();
    if (violatingModules.has(module)) {
      warnings.push(`Module is already used in 2 requirements`);
    }

    // Check for prerequisite warnings
    try {
      const prereqRules = await dbService.getModulePrerequisites(module);
      const requiredModules = prereqRules
        .flatMap(rule => Array.isArray(rule.required_modules) ? rule.required_modules : [])
        .filter((v, i, arr) => v && arr.indexOf(v) === i);

      if (requiredModules.length > 0) {
        const selectedModules = this.validator.getSelectedModules();
        const missingPrereqs = requiredModules.filter(
          prereq => !selectedModules.has(prereq as ModuleCode)
        );
        if (missingPrereqs.length > 0) {
          warnings.push(`Missing prerequisites: ${missingPrereqs.join(', ')}`);
        }
      }

    } catch (error) {
      console.error(`Error checking prerequisites for ${module}:`, error);
    }

    return warnings;
  }

  /**
   * Check if a requirement path is at max capacity
   */
  private isPathAtMaxCap(pathKey: string): boolean {
    // Extract programme ID and path from pathKey
    const [programmeId, ...pathParts] = pathKey.split(':');
    const programme = this.getProgramme(programmeId);
    if (!programme) return false;

    // Find the path with max rule
    for (const section of programme.sections) {
      for (const path of section.paths) {
        if (path.ruleType === 'max' && pathKey.includes(path.pathKey)) {
          const maxRuleId = `${programmeId}_${path.pathId}_max`;
          const currentFulfilled = this.validator['validationState'].maxRuleFulfillment.get(maxRuleId) || 0;
          return currentFulfilled >= (path.ruleValue || 0);
        }
      }
    }

    return false;
  }

  /**
   * Get programme by ID
   */
  private getProgramme(programmeId: string): ProgrammePayload | undefined {
    return this.programmes.find(p => p.programmeId === programmeId);
  }

  /**
   * Get module AU value with caching and database integration
   */
  private async getModuleAU(module: ModuleCode): Promise<number> {
    // Check local cache first
    if (this.moduleAUCache.has(module)) {
      return this.moduleAUCache.get(module)!;
    }

    // Fallback to database
    try {
      const au = await dbService.getModuleAU(module);
      this.moduleAUCache.set(module, au);
      return au;
    } catch (error) {
      console.error(`Error fetching AU for ${module}:`, error);
      // Final fallback to 4 AU
      this.moduleAUCache.set(module, 4);
      return 4;
    }
  }

  /**
   * Format tag display text based on current state
   */
  formatTagDisplay(tag: ModuleTag): {
    displayText: string;
    className: string;
    tooltip: string;
  } {
    const activeLabels = tag.labels.filter(label => !label.isDulled);
    const dulledLabels = tag.labels.filter(label => label.isDulled);

    let displayText = tag.type;
    let className = `tag-${tag.type.toLowerCase()}`;
    let tooltip = '';

    if (tag.isFaded) {
      className += ' tag-faded';
      displayText += ' (all inactive)';
    } else if (dulledLabels.length > 0) {
      className += ' tag-partial';
      displayText += ` (${activeLabels.length}/${tag.labels.length})`;
    }

    // Build tooltip content
    tooltip = tag.labels.map(label => {
      const status = label.isDulled ? ' (inactive)' : label.isHighlighted ? ' (at cap)' : '';
      return `${label.text}${status}: ${label.context}`;
    }).join('\n');

    return { displayText, className, tooltip };
  }

  /**
   * Get decision dialog styling and content
   */
  getDecisionDialogContent(decision: PendingDecision): {
    options: Array<{
      id: string;
      label: string;
      description: string;
      utilizationBar: { current: number; max: number; percentage: number };
      isRecommended: boolean;
    }>;
  } {
    const options = decision.options.map(option => ({
      id: option.id,
      label: option.label,
      description: option.description,
      utilizationBar: {
        current: option.currentUsage ?? 0,
        max: option.maxCapacity ?? 0,
        percentage: Math.round((option.utilizationRate ?? 0) * 100)
      },
      isRecommended: (option.utilizationRate ?? 0) < 0.7
    }));

    // Sort by utilization rate (lower first)
    options.sort((a, b) => a.utilizationBar.percentage - b.utilizationBar.percentage);

    return { options };
  }

  /**
   * Clear optimizer caches (useful when switching between academic plans)
   */
  clearCaches(): void {
    this.moduleAUCache.clear();
  }

  /**
   * Get optimizer cache statistics for debugging
   */
  getOptimizerStats(): {
    cachedModuleAUs: number;
    totalProgrammes: number;
    totalModulesInLookup: number;
  } {
    return {
      cachedModuleAUs: this.moduleAUCache.size,
      totalProgrammes: this.programmes.length,
      totalModulesInLookup: Object.keys(this.lookupMaps.moduleToLeafPaths).length
    };
  }
}