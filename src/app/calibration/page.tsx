'use client';

import { useState } from 'react';
import { Wrench, Zap, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { generateCalibrationSchedule } from '@/ai/flows/calibration-schedule';
import type { CalibrationScheduleInput, CalibrationScheduleOutput } from '@/ai/flows/calibration-schedule';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

const formSchema = z.object({
  usageTrends: z.string().min(50, { message: "Usage trends must be at least 50 characters." }).max(2000),
  maintenanceLogs: z.string().min(50, { message: "Maintenance logs must be at least 50 characters." }).max(2000),
  upcomingBookings: z.string().min(50, { message: "Upcoming bookings information must be at least 50 characters." }).max(2000),
});

export default function CalibrationPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calibrationResult, setCalibrationResult] = useState<CalibrationScheduleOutput | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      usageTrends: '',
      maintenanceLogs: '',
      upcomingBookings: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setError(null);
    setCalibrationResult(null);
    try {
      const inputData: CalibrationScheduleInput = values;
      const result = await generateCalibrationSchedule(inputData);
      setCalibrationResult(result);
    } catch (e) {
      console.error("Error generating calibration schedule:", e);
      setError(e instanceof Error ? e.message : "An unknown error occurred.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Smart Calibration Tool"
        description="Generate an optimized calibration schedule for lab resources using AI."
        icon={Wrench}
      />

      <Card className="shadow-lg">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardHeader>
              <CardTitle>Input Resource Data</CardTitle>
              <CardDescription>
                Provide detailed information about resource usage, maintenance history, and future bookings to generate an accurate schedule.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="usageTrends"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="usageTrends">Usage Trends</FormLabel>
                    <FormControl>
                      <Textarea
                        id="usageTrends"
                        placeholder="Describe historical data on resource usage. E.g., 'Microscope A is used heavily on Mondays and Wednesdays, average 6 hours/day. Centrifuge B usage is sporadic, averaging 2 hours/week.'"
                        rows={5}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="maintenanceLogs"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="maintenanceLogs">Maintenance Logs</FormLabel>
                    <FormControl>
                      <Textarea
                        id="maintenanceLogs"
                        placeholder="Summarize records of past maintenance and calibration activities. E.g., 'Microscope A last calibrated 2023-12-15, passed. Centrifuge B had rotor replaced 2024-02-01, calibration due.'"
                        rows={5}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="upcomingBookings"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="upcomingBookings">Upcoming Bookings</FormLabel>
                    <FormControl>
                      <Textarea
                        id="upcomingBookings"
                        placeholder="Detail information about upcoming resource bookings for the next 2-4 weeks. E.g., 'Microscope A booked solid next week for Project X. Centrifuge B booked for Dr. Smith on 2024-07-10 for 4 hours.'"
                        rows={5}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="border-t px-6 py-4">
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" /> Generate Schedule
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {calibrationResult && (
        <Card className="shadow-lg mt-8">
          <CardHeader>
            <div className="flex items-center gap-2">
                <CheckCircle className="h-6 w-6 text-green-500" />
                <CardTitle>Generated Calibration Schedule</CardTitle>
            </div>
            <CardDescription>
              The AI has analyzed the provided data and generated the following optimized schedule.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg mb-2">Proposed Schedule:</h3>
              <div className="p-4 bg-muted rounded-md whitespace-pre-wrap text-sm leading-relaxed">
                {calibrationResult.schedule}
              </div>
            </div>
            <Separator />
            <div>
              <h3 className="font-semibold text-lg mb-2">Justification:</h3>
              <div className="p-4 bg-muted rounded-md whitespace-pre-wrap text-sm leading-relaxed">
                {calibrationResult.justification}
              </div>
            </div>
          </CardContent>
           <CardFooter>
            <p className="text-xs text-muted-foreground">
              Please review this schedule carefully and adjust as necessary based on specific lab protocols and unforeseen circumstances.
            </p>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
