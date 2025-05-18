// src/ai/flows/calibration-schedule.ts
'use server';
/**
 * @fileOverview Generates an optimized calibration schedule for lab resources.
 *
 * - generateCalibrationSchedule - A function that generates the calibration schedule.
 * - CalibrationScheduleInput - The input type for the generateCalibrationSchedule function.
 * - CalibrationScheduleOutput - The return type for the generateCalibrationSchedule function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CalibrationScheduleInputSchema = z.object({
  usageTrends: z.string().describe('Historical data on resource usage.'),
  maintenanceLogs: z.string().describe('Records of past maintenance and calibration activities.'),
  upcomingBookings: z.string().describe('Information about upcoming resource bookings.'),
});
export type CalibrationScheduleInput = z.infer<typeof CalibrationScheduleInputSchema>;

const CalibrationScheduleOutputSchema = z.object({
  schedule: z.string().describe('An optimized calibration schedule for lab resources.'),
  justification: z.string().describe('The reasoning behind the generated schedule.'),
});
export type CalibrationScheduleOutput = z.infer<typeof CalibrationScheduleOutputSchema>;

export async function generateCalibrationSchedule(
  input: CalibrationScheduleInput
): Promise<CalibrationScheduleOutput> {
  return generateCalibrationScheduleFlow(input);
}

const prompt = ai.definePrompt({
  name: 'calibrationSchedulePrompt',
  input: {schema: CalibrationScheduleInputSchema},
  output: {schema: CalibrationScheduleOutputSchema},
  prompt: `You are an AI assistant that generates optimized calibration schedules for lab resources.

  Based on the provided usage trends, maintenance logs, and upcoming bookings, create a detailed calibration schedule. Explain the reasoning behind the schedule, considering the need to minimize downtime and ensure resources are properly maintained.

  Usage Trends: {{{usageTrends}}}
  Maintenance Logs: {{{maintenanceLogs}}}
  Upcoming Bookings: {{{upcomingBookings}}}

  Calibration Schedule:`,
});

const generateCalibrationScheduleFlow = ai.defineFlow(
  {
    name: 'generateCalibrationScheduleFlow',
    inputSchema: CalibrationScheduleInputSchema,
    outputSchema: CalibrationScheduleOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
