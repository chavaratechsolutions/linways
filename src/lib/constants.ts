export const LEAVE_LIMITS = {
    "Casual Leave": 15,
    "Duty Leave": 15,
    "Vacation Leave": 30,
    "Maternity Leave": 90,
    "Compensatory Leave": 365
} as const;

export type LeaveType = keyof typeof LEAVE_LIMITS;
