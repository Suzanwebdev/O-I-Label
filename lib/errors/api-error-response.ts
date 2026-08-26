import { NextResponse } from "next/server";
import {
  observeOperationalEvent,
  type OperationalCategory,
  type OperationalSeverity,
  type OperationalSurface,
} from "@/lib/errors/capture-event";
import {
  sanitizeCustomerError,
  type CustomerOperation,
} from "@/lib/errors/safe-response";

/**
 * Server-only customer error response that preserves the Phase 4B envelope
 * and optionally records an operational event (Phase 4C).
 */
export function apiCustomerErrorResponse(
  status: number,
  options: {
    operation: CustomerOperation;
    message?: string | null;
    trusted?: boolean;
    extra?: Record<string, unknown>;
    capture?: {
      severity?: OperationalSeverity;
      category: OperationalCategory;
      surface: OperationalSurface;
      code: string;
      metadata?: Record<string, unknown>;
    };
  }
): NextResponse {
  const sanitized = sanitizeCustomerError(options);
  if (options.capture) {
    observeOperationalEvent({
      severity: options.capture.severity ?? "error",
      category: options.capture.category,
      surface: options.capture.surface,
      code: options.capture.code,
      message: options.message?.trim() || sanitized.error,
      incidentId: sanitized.incidentId,
      metadata: {
        http_status: status,
        operation: options.operation,
        ...(options.capture.metadata ?? {}),
      },
    });
  }
  return NextResponse.json(
    {
      ...(options.extra ?? {}),
      error: sanitized.error,
      ...(sanitized.incidentId ? { incidentId: sanitized.incidentId } : {}),
    },
    { status }
  );
}
