"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
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

  return `${String(h).padStart(2, "0")}:${minutes}`;
}

// ─── Component ─────────────────────────────────────────────────────────────

interface TaskFormProps {
  onSubmit: (payload: {
    title: string;
    description: string;
    priority: "low" | "high";
    scheduled_date: string;
    start_time: string;
  }) => void;
  onCancel?: () => void;
}

export function TaskForm({ onSubmit, onCancel }: TaskFormProps) {
  const form = useForm<TaskFormValues>({
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

    form.reset();
  }

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
      {/* ── Title ──────────────────────────────────────────────────── */}
      <Controller
        control={form.control}
        name="title"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name}>Title</FieldLabel>
            <Input
              {...field}
              id={field.name}
              placeholder="What do you need to do?"
              maxLength={100}
              aria-invalid={fieldState.invalid}
            />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      {/* ── Description ────────────────────────────────────────────── */}
      <Controller
        control={form.control}
        name="description"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name}>Description</FieldLabel>
            <Textarea
              {...field}
              id={field.name}
              placeholder="Optional details…"
              className="resize-none"
              rows={3}
              aria-invalid={fieldState.invalid}
            />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      {/* ── Priority ───────────────────────────────────────────────── */}
      <Controller
        control={form.control}
        name="priority"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel>Priority</FieldLabel>
            <div className="flex gap-1">
              <Button
                type="button"
                variant={field.value === "low" ? "default" : "outline"}
                size="sm"
                onClick={() => field.onChange("low")}
                aria-pressed={field.value === "low"}
              >
                Low
              </Button>
              <Button
                type="button"
                variant={field.value === "high" ? "default" : "outline"}
                size="sm"
                onClick={() => field.onChange("high")}
                aria-pressed={field.value === "high"}
              >
                High
              </Button>
            </div>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      {/* ── Date ───────────────────────────────────────────────────── */}
      <Controller
        control={form.control}
        name="date"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel>Date</FieldLabel>
            <Popover>
              <PopoverTrigger
                id={field.name}
                aria-invalid={fieldState.invalid}
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "w-full justify-start text-left font-normal",
                  !field.value && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {field.value ? format(field.value, "PPP") : "Pick a date"}
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
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      {/* ── Time ───────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <Label>Time</Label>
        <div className="flex items-end gap-2">
          {/* Hours */}
          <Controller
            control={form.control}
            name="hours"
            render={({ field, fieldState }) => (
              <Field className="flex-1" data-invalid={fieldState.invalid}>
                <Select
                  name={field.name}
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger
                    id={field.name}
                    aria-invalid={fieldState.invalid}
                  >
                    <SelectValue placeholder="HH" />
                  </SelectTrigger>
                  <SelectContent>
                    {hoursItems.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          <span className="pb-2 text-sm text-muted-foreground">:</span>

          {/* Minutes */}
          <Controller
            control={form.control}
            name="minutes"
            render={({ field, fieldState }) => (
              <Field className="flex-1" data-invalid={fieldState.invalid}>
                <Select
                  name={field.name}
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger
                    id={field.name}
                    aria-invalid={fieldState.invalid}
                  >
                    <SelectValue placeholder="MM" />
                  </SelectTrigger>
                  <SelectContent>
                    {MINUTES.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          {/* Format toggle (AM / PM / 24h) */}
          <Controller
            control={form.control}
            name="timeFormat"
            render={({ field, fieldState }) => (
              <Field className="flex-1" data-invalid={fieldState.invalid}>
                <Select
                  name={field.name}
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger
                    id={field.name}
                    aria-invalid={fieldState.invalid}
                  >
                    <SelectValue placeholder="fmt" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_FORMATS.map((fmt) => (
                      <SelectItem key={fmt} value={fmt}>
                        {fmt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        </div>
      </div>

      {/* ── Actions ────────────────────────────────────────────────── */}
      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit">Add Task</Button>
      </div>
    </form>
  );
}
