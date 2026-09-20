export const allowedTransitions: Record<string, string[]> = {
    DRAFT: ['SUBMITTED'],
    SUBMITTED: ['UNDER_REVIEW'],
    UNDER_REVIEW: ['ASSIGNED'],
    ASSIGNED: ['SCHEDULED'],
    SCHEDULED: ['INSPECTION_IN_PROGRESS'],
    INSPECTION_IN_PROGRESS: ['PASSED', 'REINSPECTION_REQUIRED'],
    REINSPECTION_REQUIRED: ['SCHEDULED'],
    PASSED: ['CERTIFICATE_ISSUED'],
    CERTIFICATE_ISSUED: []
};

export const canTransition = (from: string, to: string) => allowedTransitions[from]?.includes(to) === true;
