"use client";

import React, { useState, useEffect, useRef } from "react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isWithinInterval, isAfter, isBefore, addDays } from "date-fns";
import { CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";

interface DateRangePickerProps {
    startDate: string;
    endDate: string;
    onDateChange: (start: string, end: string) => void;
    placeholder?: string;
}

export default function DateRangePicker({ startDate, endDate, onDateChange, placeholder = "Filter by date range" }: DateRangePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(startDate ? new Date(startDate) : new Date());
    const [hoverDate, setHoverDate] = useState<Date | null>(null);
    const popoverRef = useRef<HTMLDivElement>(null);

    const parsedStartDate = startDate ? new Date(startDate) : null;
    const parsedEndDate = endDate ? new Date(endDate) : null;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handlePreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
    const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

    const handleDateClick = (day: Date) => {
        if (!parsedStartDate && !parsedEndDate) {
            onDateChange(format(day, "yyyy-MM-dd"), "");
        } else if (parsedStartDate && !parsedEndDate) {
            if (isSameDay(day, parsedStartDate)) {
                // Clicked the same day again: interpret as single day selection
                onDateChange(startDate, format(day, "yyyy-MM-dd"));
                setIsOpen(false);
            } else if (isBefore(day, parsedStartDate)) {
                // Clicked a day before the start date: start over with the new day
                onDateChange(format(day, "yyyy-MM-dd"), "");
            } else {
                // Clicked a day after: valid range
                onDateChange(startDate, format(day, "yyyy-MM-dd"));
                setIsOpen(false);
            }
        } else if (parsedStartDate && parsedEndDate) {
            // Already have a range, reset to start new selection
            onDateChange(format(day, "yyyy-MM-dd"), "");
        }
    };

    const handleDateHover = (day: Date) => {
        if (parsedStartDate && !parsedEndDate) {
            setHoverDate(day);
        } else {
            setHoverDate(null);
        }
    };

    const clearSelection = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDateChange("", "");
        setCurrentMonth(new Date());
    };

    const renderHeader = () => {
        return (
            <div className="flex justify-between items-center mb-4">
                <button
                    onClick={handlePreviousMonth}
                    className="p-1 rounded-full hover:bg-gray-100 transition duration-200"
                >
                    <ChevronLeft className="h-5 w-5 text-gray-600" />
                </button>
                <div className="font-semibold text-sm text-gray-800">
                    {format(currentMonth, "MMMM yyyy")}
                </div>
                <button
                    onClick={handleNextMonth}
                    className="p-1 rounded-full hover:bg-gray-100 transition duration-200"
                >
                    <ChevronRight className="h-5 w-5 text-gray-600" />
                </button>
            </div>
        );
    };

    const renderDays = () => {
        const days = [];
        const dateFormat = "eeeeee";
        const startDate = startOfWeek(currentMonth);

        for (let i = 0; i < 7; i++) {
            days.push(
                <div key={i} className="text-center font-medium text-xs text-gray-500 py-1">
                    {format(addMonths(startDate, i), dateFormat)}
                </div>
            );
        }
        return <div className="grid grid-cols-7 mb-2">{days}</div>;
    };

    const renderCells = () => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(monthStart);
        const startDateOfGrid = startOfWeek(monthStart);
        const endDateOfGrid = endOfWeek(monthEnd);

        const dateFormat = "d";
        const rows = [];
        let days = [];
        let day = startDateOfGrid;
        let formattedDate = "";

        while (day <= endDateOfGrid) {
            for (let i = 0; i < 7; i++) {
                formattedDate = format(day, dateFormat);
                const cloneDay = day;

                const isSelectedStart = parsedStartDate && isSameDay(day, parsedStartDate);
                const isSelectedEnd = parsedEndDate && isSameDay(day, parsedEndDate);
                const isWithinSelection = parsedStartDate && parsedEndDate && isWithinInterval(day, { start: parsedStartDate, end: parsedEndDate });
                const isWithinHover = parsedStartDate && !parsedEndDate && hoverDate && (isWithinInterval(day, { start: parsedStartDate, end: hoverDate }) || isWithinInterval(day, { start: hoverDate, end: parsedStartDate }));

                const bgClass = isSelectedStart || isSelectedEnd
                    ? "bg-blue-600 text-white font-bold"
                    : isWithinSelection || isWithinHover
                        ? "bg-blue-50 text-blue-900"
                        : !isSameMonth(day, monthStart)
                            ? "text-gray-300"
                            : "text-gray-700 hover:bg-gray-100";

                const roundedClass = isSelectedStart && isSelectedEnd ? "rounded-full" : isSelectedStart ? "rounded-l-full" : isSelectedEnd ? "rounded-r-full" : "";

                days.push(
                    <div
                        key={day.toString()}
                        className={`p-0.5 cursor-pointer relative ${isWithinSelection || isWithinHover ? "bg-blue-50" : ""}`}
                        onMouseEnter={() => handleDateHover(cloneDay)}
                        onClick={() => handleDateClick(cloneDay)}
                    >
                        <div className={`flex items-center justify-center h-8 w-8 text-xs transition-colors mx-auto ${bgClass} ${roundedClass}`}>
                            {formattedDate}
                        </div>
                    </div>
                );
                day = addDays(day, 1);
            }
            rows.push(
                <div className="grid grid-cols-7" key={day.toString()}>
                    {days}
                </div>
            );
            days = [];
        }
        return <div>{rows}</div>;
    };

    const getDisplayText = () => {
        if (startDate && endDate) {
            return `${format(new Date(startDate), "MMM d, yyyy")} - ${format(new Date(endDate), "MMM d, yyyy")}`;
        }
        if (startDate) {
            return `${format(new Date(startDate), "MMM d, yyyy")} - Select end date`;
        }
        return placeholder;
    };

    return (
        <div className="relative w-full md:w-64" ref={popoverRef}>
            <div
                className="flex items-center justify-between w-full bg-white border border-gray-300 rounded-xl px-3 py-2 md:py-2.5 text-xs md:text-sm text-gray-700 cursor-pointer hover:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-shadow shadow-sm"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-2 truncate">
                    <CalendarIcon className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="truncate">{getDisplayText()}</span>
                </div>
                {(startDate || endDate) && (
                    <button
                        onClick={clearSelection}
                        className="p-0.5 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                        title="Clear dates"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>

            {isOpen && (
                <div className="absolute z-50 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 w-72 left-0 md:left-auto md:right-0">
                    {renderHeader()}
                    {renderDays()}
                    {renderCells()}
                </div>
            )}
        </div>
    );
}
