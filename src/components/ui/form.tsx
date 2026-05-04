"use client";

import { createContext, useContext } from "react";
import {
  Controller,
  FormProvider,
  useFormContext,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { cn } from "@/lib/utils";
import { Label } from "./label";

export const Form = FormProvider;

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = { name: TName };

const FormFieldContext = createContext<FormFieldContextValue>({} as FormFieldContextValue);

export function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({ ...props }: ControllerProps<TFieldValues, TName>) {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
}

const FormItemContext = createContext<{ id: string }>({} as { id: string });

export function FormItem({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const id = Math.random().toString(36).slice(2);
  return (
    <FormItemContext.Provider value={{ id }}>
      <div className={cn("space-y-1.5", className)} {...props} />
    </FormItemContext.Provider>
  );
}

export function FormLabel({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Label>) {
  const { id } = useContext(FormItemContext);
  const { name } = useContext(FormFieldContext);
  const { formState } = useFormContext();
  const error = formState.errors[name];

  return (
    <Label
      className={cn(error && "text-negative", className)}
      htmlFor={id}
      {...props}
    />
  );
}

export function FormControl({ ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { id } = useContext(FormItemContext);
  const { name } = useContext(FormFieldContext);
  const { formState } = useFormContext();
  const error = formState.errors[name];

  return (
    <div
      id={id}
      aria-invalid={!!error}
      aria-describedby={error ? `${id}-error` : undefined}
      {...props}
    />
  );
}

export function FormDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  const { id } = useContext(FormItemContext);
  return (
    <p className={cn("text-[12px] text-fg-muted", className)} id={`${id}-description`} {...props} />
  );
}

export function FormMessage({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  const { id } = useContext(FormItemContext);
  const { name } = useContext(FormFieldContext);
  const { formState } = useFormContext();
  const error = formState.errors[name];
  const body = error ? String(error?.message) : children;

  if (!body) return null;

  return (
    <p
      id={`${id}-error`}
      className={cn("text-[12px] font-medium text-negative", className)}
      {...props}
    >
      {body}
    </p>
  );
}
