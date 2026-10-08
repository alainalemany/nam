"use client";

// Adapted from the licensed Metronic 9.5.0 Next.js starter kit Card primitive.
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

type CardContextType = { variant: "default" | "accent" };
const CardContext = React.createContext<CardContextType>({ variant: "default" });

const cardVariants = cva(
  "flex flex-col items-stretch text-card-foreground rounded-xl",
  {
    variants: {
      variant: {
        default: "bg-card border border-border shadow-xs",
        accent: "bg-muted shadow-xs p-1",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Card({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardVariants>) {
  return (
    <CardContext.Provider value={{ variant: variant ?? "default" }}>
      <div className={cn(cardVariants({ variant }), className)} {...props} />
    </CardContext.Provider>
  );
}

function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { variant } = React.useContext(CardContext);
  return (
    <div
      className={cn(
        "flex min-h-14 flex-wrap items-center justify-between gap-2.5 px-5",
        variant === "default" && "border-b border-border",
        className,
      )}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { variant } = React.useContext(CardContext);
  return (
    <div
      className={cn(
        "grow p-5",
        variant === "accent" && "rounded-t-xl bg-card last:rounded-b-xl",
        className,
      )}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { variant } = React.useContext(CardContext);
  return (
    <div
      className={cn(
        "flex min-h-14 items-center px-5",
        variant === "default" ? "border-t border-border" : "mt-0.5 rounded-b-xl bg-card",
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-base font-semibold leading-none tracking-tight", className)} {...props} />;
}

function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
