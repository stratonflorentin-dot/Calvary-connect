"use client";

import { CheckCircle, Circle, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WorkflowStep {
  id: string;
  label: string;
  status: "completed" | "in_progress" | "pending" | "error";
  timestamp?: string;
  description?: string;
}

interface WorkflowTimelineProps {
  steps: WorkflowStep[];
  orientation?: "horizontal" | "vertical";
  size?: "sm" | "md" | "lg";
}

export function WorkflowTimeline({ 
  steps, 
  orientation = "horizontal", 
  size = "md" 
}: WorkflowTimelineProps) {
  const sizeClasses = {
    sm: "size-4",
    md: "size-6",
    lg: "size-8"
  };

  const textSizes = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base"
  };

  const isHorizontal = orientation === "horizontal";

  return (
    <div className={cn(
      "flex",
      isHorizontal ? "flex-row items-center gap-2" : "flex-col gap-4"
    )}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        
        return (
          <div 
            key={step.id} 
            className={cn(
              "flex",
              isHorizontal ? "flex-1 flex-col items-center" : "flex-row items-start gap-4"
            )}
          >
            {/* Step Icon */}
            <div className="relative flex items-center">
              <div className={cn(
                "flex items-center justify-center rounded-full border-2",
                step.status === "completed" && "bg-success border-success text-white",
                step.status === "in_progress" && "bg-primary border-primary text-white animate-pulse",
                step.status === "pending" && "bg-muted border-muted-foreground/30 text-muted-foreground",
                step.status === "error" && "bg-destructive border-destructive text-white",
                sizeClasses[size]
              )}>
                {step.status === "completed" && <CheckCircle className={sizeClasses[size]} />}
                {step.status === "in_progress" && <Clock className={sizeClasses[size]} />}
                {step.status === "pending" && <Circle className={sizeClasses[size]} />}
                {step.status === "error" && <AlertCircle className={sizeClasses[size]} />}
              </div>
              
              {/* Connector Line */}
              {!isLast && (
                <div 
                  className={cn(
                    "absolute border-2",
                    step.status === "completed" ? "border-success" : "border-muted-foreground/30",
                    isHorizontal 
                      ? "left-full top-1/2 -translate-y-1/2 w-full h-0" 
                      : "top-full left-1/2 -translate-x-1/2 h-full w-0"
                  )}
                />
              )}
            </div>

            {/* Step Info */}
            <div className={cn(
              "flex flex-col",
              isHorizontal ? "mt-2 text-center" : "flex-1"
            )}>
              <span className={cn(
                "font-medium",
                textSizes[size],
                step.status === "in_progress" && "text-primary",
                step.status === "error" && "text-destructive"
              )}>
                {step.label}
              </span>
              {step.description && (
                <span className={cn(
                  "text-muted-foreground",
                  textSizes[size]
                )}>
                  {step.description}
                </span>
              )}
              {step.timestamp && (
                <span className={cn(
                  "text-muted-foreground text-xs",
                  isHorizontal ? "mt-1" : "mt-0.5"
                )}>
                  {new Date(step.timestamp).toLocaleString()}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Preset workflow configurations for common ERP entities
export function getLeadWorkflowSteps(lead: any): WorkflowStep[] {
  return [
    {
      id: "new",
      label: "New Lead",
      status: "completed",
      timestamp: lead.created_at
    },
    {
      id: "contacted",
      label: "Contacted",
      status: lead.status === "new" ? "pending" : 
              lead.status === "contacted" ? "in_progress" : "completed"
    },
    {
      id: "qualified",
      label: "Qualified",
      status: lead.status === "qualified" ? "in_progress" : 
              lead.status === "converted" ? "completed" : "pending"
    },
    {
      id: "converted",
      label: "Converted to Customer",
      status: lead.status === "converted" ? "completed" : "pending",
      timestamp: lead.converted_to_customer_id ? lead.updated_at : undefined
    }
  ];
}

export function getQuotationWorkflowSteps(quotation: any): WorkflowStep[] {
  return [
    {
      id: "draft",
      label: "Draft",
      status: "completed",
      timestamp: quotation.created_at
    },
    {
      id: "sent",
      label: "Sent to Customer",
      status: quotation.approval_status === "sent" ? "in_progress" : 
              quotation.approval_status === "viewed" || quotation.approval_status === "approved" ? "completed" : "pending",
      timestamp: quotation.sent_at
    },
    {
      id: "viewed",
      label: "Viewed by Customer",
      status: quotation.approval_status === "viewed" ? "in_progress" : 
              quotation.approval_status === "approved" ? "completed" : "pending",
      timestamp: quotation.viewed_at
    },
    {
      id: "approved",
      label: "Approved",
      status: quotation.approval_status === "approved" ? "completed" : "pending",
      timestamp: quotation.approved_at
    },
    {
      id: "converted",
      label: "Converted to Booking",
      status: quotation.approval_status === "converted" ? "completed" : "pending",
      timestamp: quotation.converted_to_booking_id ? quotation.updated_at : undefined
    }
  ];
}

export function getTripWorkflowSteps(trip: any): WorkflowStep[] {
  return [
    {
      id: "created",
      label: "Trip Created",
      status: "completed",
      timestamp: trip.created_at
    },
    {
      id: "loaded",
      label: "Loaded",
      status: trip.status === "LOADED" ? "in_progress" : 
              trip.status === "IN_TRANSIT" || trip.status === "DELIVERED" || trip.status === "COMPLETED" ? "completed" : "pending"
    },
    {
      id: "in_transit",
      label: "In Transit",
      status: trip.status === "IN_TRANSIT" ? "in_progress" : 
              trip.status === "DELIVERED" || trip.status === "COMPLETED" ? "completed" : "pending"
    },
    {
      id: "delivered",
      label: "Delivered",
      status: trip.status === "DELIVERED" ? "in_progress" : 
              trip.status === "COMPLETED" ? "completed" : "pending"
    },
    {
      id: "pod_uploaded",
      label: "POD Uploaded",
      status: trip.pod_status === "uploaded" ? "in_progress" : 
              trip.pod_status === "verified" ? "completed" : "pending"
    },
    {
      id: "completed",
      label: "Completed",
      status: trip.status === "COMPLETED" ? "completed" : "pending"
    }
  ];
}

export function getBookingWorkflowSteps(booking: any): WorkflowStep[] {
  return [
    {
      id: "created",
      label: "Booking Created",
      status: "completed",
      timestamp: booking.created_at
    },
    {
      id: "confirmed",
      label: "Confirmed",
      status: booking.status === "confirmed" ? "in_progress" : 
              booking.status === "in_progress" || booking.status === "completed" ? "completed" : "pending"
    },
    {
      id: "in_progress",
      label: "In Progress",
      status: booking.status === "in_progress" ? "in_progress" : 
              booking.status === "completed" ? "completed" : "pending"
    },
    {
      id: "completed",
      label: "Completed",
      status: booking.status === "completed" ? "completed" : "pending"
    }
  ];
}
