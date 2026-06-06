"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

// ─── Constants ─────────────────────────────────────────────────────────────

export type TimeFormat = "AM" | "PM" | "24h";

const TIME_FORMATS: TimeFormat[] = ["AM", "PM", "24h"];

/** Generate 0-padded hour labels for range [`start`, `end`] inclusive. */
function hourOptions(start: number, end: number): string[] {
  const labels: string[] = [];
  for (let h = start; h <= end; h++) {
    labels.push(String(h).padStart(2, "0"));
  }
  return labels;
}

const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

// ─── Zod Schema ────────────────────────────────────────────────────────────

const timeFormatSchema = z.enum(["AM", "PM", "24h"]);

export const taskFormSchema = z
  .object({
    title: z
      .string()
      .min(1, "Title is required")
      .max(100, "Title must be 100 characters or fewer"),
    description: z.string().default(""),
    priority: z.enum(["low", "high"]),
    date: z.date({ message: "Please select a date" }),
    hours: z.string().min(1, "Hour is required"),
    minutes: z.string().min(1, "Minute is required"),
    timeFormat: timeFormatSchema,
  })
  .superRefine((data, ctx) => {
    const hourNum = Number(data.hours);
    if (data.timeFormat === "24h") {
      if (hourNum < 0 || hourNum > 23) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Hour must be between 00 and 23",
          path: ["hours"],
        });
      }
    } else {
      if (hourNum < 1 || hourNum > 12) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Hour must be between 01 and 12",
          path: ["hours"],
        });
      }
    }
  });

export type TaskFormValues = z.infer<typeof taskFormSchema>;

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Convert form time fields into a 24-hour `HH:mm` string. */
export function toHHmm(hours: string, minutes: string, timeFormat: TimeFormat): string {
  let h = Number(hours);

  if (timeFormat === "AM") {
    if (h === 12) h = 0;
  } else if (timeFormat === "PM") {
    if (h !== 12) h += 12;
  }
  // "24h" — use hours as-is

  return `${String(h).padStart(2, "0")}:${minutes}`;
}

// ─── Component ─────────────────────────────────────────────────────────────

interface TaskFormProps {
  /** Callback receiving the clean payload ready for IndexedDB. */
  onSubmit: (payload: {
    title: string;
    description: string;
    priority: "low" | "high";
    scheduled_date: string; // YYYY-MM-DD
    start_time: string;     // HH:mm
  }) => void;
  onCancel?: () => void;
}

export function TaskForm({ onSubmit, onCancel }: TaskFormProps) {
  const form = useForm<TaskFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(taskFormSchema) as any,
    defaultValues: {
      title: "",
      description: "",
      priority: "low",
      date: undefined,
      hours: "09",
      minutes: "00",
      timeFormat: "AM",
    },
  });

  const watchTimeFormat = form.watch("timeFormat");

  // Derive hour options based on selected time format
  const hoursItems = React.useMemo<string[]>(() => {
    if (watchTimeFormat === "24h") return hourOptions(0, 23);
    return hourOptions(1, 12);
  }, [watchTimeFormat]);

  // ── Submit handler ──────────────────────────────────────────────────
  function handleSubmit(values: TaskFormValues) {
    const scheduled_date = format(values.date, "yyyy-MM-dd");
    const start_time = toHHmm(values.hours, values.minutes, values.timeFormat as TimeFormat);

    onSubmit({
      title: values.title.trim(),
      description: values.description.trim(),
      priority: values.priority,
      scheduled_date,
      start_time,
    });

    // Clear form so the user can quickly add another task
    form.reset();
  }

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
        {/* ── Title ────────────────────────────────────────────────── */}
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="What do you need to do?" maxLength={100} {...field} />
              </FormControl>
              <FormDescription>Required — max 100 characters.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* ── Description ──────────────────────────────────────────── */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Optional details…"
                  className="resize-none"
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* ── Priority ─────────────────────────────────────────────── */}
        <FormField
          control={form.control}
          name="priority"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Priority</FormLabel>
              <FormControl>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant={field.value === "low" ? "default" : "outline"}
                    size="sm"
                    onClick={() => field.onChange("low")}
                  >
                    Low
                  </Button>
                  <Button
                    type="button"
                    variant={field.value === "high" ? "default" : "outline"}
                    size="sm"
                    onClick={() => field.onChange("high")}
                  >
                    High
                  </Button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* ── Date ─────────────────────────────────────────────────── */}
        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Date</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {field.value ? format(field.value, "PPP") : "Pick a date"}
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    autoFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* ── Time ─────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <FormLabel>Time</FormLabel>
          <div className="flex items-end gap-2">
            {/* Hours */}
            <FormField
              control={form.control}
              name="hours"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="HH" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {hoursItems.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <span className="pb-2 text-sm text-muted-foreground">:</span>

            {/* Minutes */}
            <FormField
              control={form.control}
              name="minutes"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="MM" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {MINUTES.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Format toggle (AM / PM / 24h) */}
            <FormField
              control={form.control}
              name="timeFormat"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="fmt" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TIME_FORMATS.map((fmt) => (
                        <SelectItem key={fmt} value={fmt}>
                          {fmt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* ── Actions ──────────────────────────────────────────────── */}
        <div className="flex justify-end gap-2 pt-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit">Add Task</Button>
        </div>
      </form>
    </Form>
  );
}
