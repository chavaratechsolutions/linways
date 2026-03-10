export const LEAVE_LIMITS = {
    "Casual Leave": 15,
    "Duty Leave": 15,
    "Vacation Leave": 30,
    "Maternity Leave": 90,
    "Compensatory Leave": 0  // Dynamically managed via HOD grants — 0 means no fixed cap
} as const;

export type LeaveType = keyof typeof LEAVE_LIMITS;
