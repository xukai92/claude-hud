export type CostTrackerDeps = {
    homeDir: () => string;
    now: () => Date;
};
export declare function updateAndGetMonthlyCost(sessionId: string | undefined, costUsd: number | undefined, overrides?: Partial<CostTrackerDeps>): number | null;
//# sourceMappingURL=cost-tracker.d.ts.map