// File: frontend/src/types/shared.ts

export interface WorkflowManagerProps {
    creditBalance: number;
    isFetchingCredits: boolean;
    updateCredits: (amount?: number) => void;
    getToken: Function;
}