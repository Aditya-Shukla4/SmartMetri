"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canTransition = exports.allowedTransitions = void 0;
exports.allowedTransitions = {
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
const canTransition = (from, to) => exports.allowedTransitions[from]?.includes(to) === true;
exports.canTransition = canTransition;
