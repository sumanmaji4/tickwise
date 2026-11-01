// Shapes returned by the Spring Boot API. Kept in one place so a backend change is a one-file update.

export type Role = "CUSTOMER" | "AGENT" | "MANAGER" | "ADMIN";
export type TicketStatus = "NEW" | "OPEN" | "PENDING_CUSTOMER" | "RESOLVED" | "CLOSED";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type Channel = "EMAIL" | "WEB" | "AGENT";

export const STATUSES: TicketStatus[] = ["NEW", "OPEN", "PENDING_CUSTOMER", "RESOLVED", "CLOSED"];
export const PRIORITIES: Priority[] = ["URGENT", "HIGH", "MEDIUM", "LOW"];

/** Mirrors TicketStatus.canTransitionTo on the server; the server remains the authority. */
export const TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  NEW: ["OPEN", "PENDING_CUSTOMER", "RESOLVED", "CLOSED"],
  OPEN: ["PENDING_CUSTOMER", "RESOLVED", "CLOSED"],
  PENDING_CUSTOMER: ["OPEN", "RESOLVED", "CLOSED"],
  RESOLVED: ["OPEN", "CLOSED"],
  CLOSED: [],
};

export interface LoginResponse {
  accessToken: string;
  tokenType: string;
  expiresAt: string;
}

export interface Me {
  userId: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  email: string;
  displayName: string;
  role: Role;
  teamId?: string;
}

export interface Ticket {
  id: number;
  subject: string;
  status: TicketStatus;
  priority: Priority;
  channel: Channel;
  customer: { id: string; email: string; name?: string };
  assigneeId?: string;
  assigneeName?: string;
  teamId?: string;
  firstResponseDueAt?: string;
  resolutionDueAt?: string;
  nextSlaDueAt?: string;
  nextSlaWarningAt?: string;
  firstRespondedAt?: string;
  resolvedAt?: string;
  slaBreached: boolean;
  slaPaused: boolean;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface SlaTimer {
  metric: "FIRST_RESPONSE" | "RESOLUTION";
  state: "RUNNING" | "PAUSED" | "MET";
  targetMinutes: number;
  consumedSeconds: number;
  dueAt?: string;
  warningAt?: string;
  metAt?: string;
  breached: boolean;
  breachedAt?: string;
}

export interface TicketDetail {
  ticket: Ticket;
  sla: { firstResponse: SlaTimer; resolution: SlaTimer };
}

export interface Attachment {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
}

export interface Message {
  id: string;
  ticketId: number;
  direction: "INBOUND" | "OUTBOUND";
  authorUserId?: string;
  authorName?: string;
  body: string;
  attachments: Attachment[];
  createdAt: string;
}

export interface AuditEntry {
  id: number;
  type: string;
  actorUserId?: string;
  details: Record<string, string>;
  createdAt: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface AppNotification {
  id: string;
  type: "SLA_WARNING" | "SLA_BREACHED" | "TICKET_ASSIGNED";
  ticketId?: number;
  message: string;
  createdAt: string;
  readAt?: string;
}

export interface Person {
  id: string;
  displayName: string;
  role: Role;
  teamId?: string;
}

export interface Team {
  id: string;
  name: string;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  teamId?: string;
  maxOpenTickets: number;
  active: boolean;
  createdAt: string;
}

export interface SlaPolicy {
  priority: Priority;
  firstResponseMinutes: number;
  resolutionMinutes: number;
}

export type DayOfWeek = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";
export const DAYS: DayOfWeek[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

export interface BusinessCalendar {
  timezone: string;
  hours: { dayOfWeek: DayOfWeek; start: string; end: string }[];
  holidays: { date: string; name: string }[];
}

export interface AssignmentSettings {
  defaultTeamId?: string;
  autoAssign: boolean;
}

export interface Metrics {
  created: number;
  open: number;
  firstResponseAvgMinutes?: number;
  firstResponseMedianMinutes?: number;
  resolutionAvgMinutes?: number;
  resolutionMedianMinutes?: number;
  firstResponseBreachRate?: number;
  resolutionBreachRate?: number;
  slaBreachRate?: number;
}

export interface ReportSummary {
  from: string;
  to: string;
  metrics: Metrics;
}

export interface TeamReportRow {
  id?: string;
  name: string;
  metrics: Metrics;
}

export interface AgentReportRow {
  id: string;
  name: string;
  teamId?: string;
  capacity: number;
  metrics: Metrics;
}

export interface DailyReport {
  timezone: string;
  points: { date: string; created: number; breached: number }[];
}

export interface SessionResponse {
  accessToken: string;
  tokenType: string;
  expiresAt: string;
  tenantSlug: string;
}

export interface Invitation {
  id: string;
  email: string;
  role: Role;
  teamId?: string;
  maxOpenTickets: number;
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
}

export interface InvitationPreview {
  tenantName: string;
  tenantSlug: string;
  email: string;
  role: Role;
}
