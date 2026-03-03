/**
 * Type Definitions and Permission System
 * 
 * Central type definitions for the DocuManage application.
 * Includes domain types, API interfaces, and the role-based access control system.
 * 
 * Architecture Overview:
 * - Domain Types: User, Document, Approval, etc.
 * - API Types: Request/Response interfaces
 * - Permission System: Role hierarchy and feature access control
 * 
 * @module types
 */

import { UserRole, DocumentType, DocumentStatus, ApprovalStep, ApprovalAction } from '@prisma/client';

// Re-export Prisma types for convenience
export { UserRole, DocumentType, DocumentStatus, ApprovalStep, ApprovalAction };

// ============================================================================
// Domain Types
// ============================================================================

/**
 * Represents a user in the system.
 * Password is excluded for security - use UserWithoutPassword for API responses.
 */
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User type safe for API responses.
 * Does not expose sensitive fields like passwordHash.
 */
export type UserWithoutPassword = User;

/**
 * Authentication state interface for Zustand store.
 * Provides login/logout functionality and session management.
 */
export interface AuthState {
  user: UserWithoutPassword | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
}

/**
 * Document domain type with all extracted and system fields.
 * Represents invoices and credit notes in the system.
 */
export interface Document {
  id: string;
  uploaderId: string;
  type: DocumentType;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  // AI-extracted fields
  invoiceNumber: string | null;
  vendorName: string | null;
  vendorAddress: string | null;
  documentDate: Date | null;
  dueDate: Date | null;
  amount: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
  currency: string | null;
  description: string | null;
  rawText: string | null;
  // Workflow state
  status: DocumentStatus;
  currentStep: number;
  isDuplicate: boolean;
  duplicateOfId: string | null;
  // Timestamps
  extractedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  // Relations
  uploader?: UserWithoutPassword;
  approvals?: Approval[];
}

/**
 * Document with uploader relation included.
 * Used for list views and detail pages.
 */
export interface DocumentWithUploader extends Document {
  uploader: UserWithoutPassword;
}

/**
 * Approval record for the 3-step workflow.
 * Tracks each approval action and comments.
 */
export interface Approval {
  id: string;
  documentId: string;
  approverId: string | null;
  step: ApprovalStep;
  action: ApprovalAction | null;
  comment: string | null;
  createdAt: Date;
  actedAt: Date | null;
  approver?: UserWithoutPassword | null;
}

/**
 * Approval with approver relation included.
 */
export interface ApprovalWithApprover extends Approval {
  approver: UserWithoutPassword;
}

// ============================================================================
// API Types
// ============================================================================

/**
 * Generic API response wrapper.
 * Provides consistent response structure across all endpoints.
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Login request credentials.
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Successful login response with user data.
 * Note: Token is set via HTTP-only cookie, not returned in body.
 */
export interface LoginResponse {
  user: UserWithoutPassword;
  accessToken: string;
}

/**
 * New user registration request.
 */
export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
}

/**
 * Response after successful document upload.
 * Includes extraction results and duplicate warnings.
 */
export interface UploadResponse {
  document: Document;
  extractionResult?: ExtractionResult;
  duplicateWarning?: DuplicateWarning;
}

/**
 * AI extraction result from document processing.
 * All fields are optional as extraction may not find all data.
 */
export interface ExtractionResult {
  invoiceNumber: string | null;
  vendorName: string | null;
  vendorAddress: string | null;
  documentDate: string | null;
  dueDate: string | null;
  amount: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
  currency: string | null;
  description: string | null;
}

/**
 * Duplicate detection warning.
 * Indicates if a similar document already exists.
 */
export interface DuplicateWarning {
  type: 'invoice_number' | 'vendor_amount';
  existingDocumentId: string;
  existingInvoiceNumber?: string;
  existingVendorName?: string;
  existingAmount?: number;
}

/**
 * Approval action request.
 */
export interface ApprovalRequest {
  documentId: string;
  action: ApprovalAction;
  comment?: string;
}

/**
 * Response for pending approvals list.
 */
export interface PendingApprovalsResponse {
  approvals: (Approval & { document: DocumentWithUploader })[];
  total: number;
}

// ============================================================================
// Report Types
// ============================================================================

/**
 * Filter options for reports and exports.
 */
export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  vendorName?: string;
  status?: DocumentStatus[];
  documentType?: DocumentType[];
  minAmount?: number;
  maxAmount?: number;
}

/**
 * Spending summary statistics.
 * Used for dashboard and reports.
 */
export interface SpendSummary {
  totalAmount: number;
  totalVat: number;
  totalDocuments: number;
  approvedCount: number;
  rejectedCount: number;
  pendingCount: number;
  draftCount: number;
  byVendor: VendorSummary[];
  byMonth: MonthlySummary[];
}

/**
 * Vendor spending breakdown.
 */
export interface VendorSummary {
  vendorName: string;
  totalAmount: number;
  documentCount: number;
  approvedCount: number;
  pendingCount: number;
}

/**
 * Monthly spending trend data.
 */
export interface MonthlySummary {
  month: string;
  totalAmount: number;
  documentCount: number;
}

// ============================================================================
// AI Insights Types
// ============================================================================

/**
 * AI-generated insight for spending analysis.
 */
export interface AIInsight {
  type: 'trend' | 'anomaly' | 'recommendation' | 'warning';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  data?: Record<string, unknown>;
}

/**
 * Insights API response.
 */
export interface InsightsResponse {
  insights: AIInsight[];
  generatedAt: Date;
}

// ============================================================================
// Role-Based Access Control (RBAC)
// ============================================================================

/**
 * Role seniority levels for hierarchical access control.
 * Higher numbers indicate higher seniority.
 * 
 * Use Case: Quick comparison of role hierarchy without
 * knowing specific permissions.
 */
export const ROLE_SENIORITY: Record<UserRole, number> = {
  ADMIN: 5,    // Full system access
  FINANCE: 4,  // Financial operations and final approval
  MANAGER: 3,  // Team management and mid-level approval
  REVIEWER: 2, // Document review and initial approval
  VIEWER: 1,   // Read-only access
};

/**
 * Feature permissions by role.
 * Each role has access to specific features.
 * 
 * Permission Keys:
 * - upload: Upload new documents
 * - view: View document list and details
 * - approve_1: First approval step (Reviewer)
 * - approve_2: Second approval step (Manager)
 * - approve_3: Third approval step (Finance)
 * - manage_users: Create/edit/delete users
 * - export_reports: Export PDF and Excel reports
 * - view_insights: Access AI insights dashboard
 * - delete_documents: Permanently delete documents
 * - manage_all_documents: Edit any document regardless of status
 */
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  ADMIN: [
    'upload', 'view', 'approve_1', 'approve_2', 'approve_3',
    'manage_users', 'export_reports', 'view_insights',
    'delete_documents', 'manage_all_documents'
  ],
  FINANCE: ['upload', 'view', 'approve_3', 'export_reports', 'view_insights'],
  MANAGER: ['upload', 'view', 'approve_2', 'export_reports', 'view_insights'],
  REVIEWER: ['upload', 'view', 'approve_1', 'export_reports'],
  VIEWER: ['view'],
};

// ============================================================================
// Permission Helper Functions
// ============================================================================

/**
 * Checks if a role meets the minimum seniority requirement.
 * 
 * @param role - User's role
 * @param requiredLevel - Minimum seniority level required
 * @returns True if role meets or exceeds required level
 * 
 * @example
 * if (hasMinimumSeniority(user.role, FEATURE_SENIORITY.UPLOAD_DOCUMENTS)) {
 *   // Allow upload
 * }
 */
export function hasMinimumSeniority(role: UserRole, requiredLevel: number): boolean {
  return ROLE_SENIORITY[role] >= requiredLevel;
}

/**
 * Checks if one role has seniority over another.
 * Useful for determining if a user can manage another user.
 * 
 * @param role - User's role
 * @param targetRole - Role to compare against
 * @returns True if role has higher seniority than target
 * 
 * @example
 * if (hasSeniorityOver(currentUser.role, targetUser.role)) {
 *   // Allow user management
 * }
 */
export function hasSeniorityOver(role: UserRole, targetRole: UserRole): boolean {
  return ROLE_SENIORITY[role] > ROLE_SENIORITY[targetRole];
}

/**
 * Gets the numeric seniority level for a role.
 * 
 * @param role - User's role
 * @returns Numeric seniority level (1-5)
 */
export function getSeniorityLevel(role: UserRole): number {
  return ROLE_SENIORITY[role];
}

/**
 * Checks if a user can perform a specific action.
 * 
 * @param role - User's role
 * @param action - Action permission string (e.g., 'upload', 'approve_1')
 * @returns True if the role has permission for the action
 * 
 * @example
 * if (canPerformAction(user.role, 'export_reports')) {
 *   // Allow report export
 * }
 */
export function canPerformAction(role: UserRole, action: string): boolean {
  // Admin can do everything
  if (role === 'ADMIN') return true;
  
  // Check if the action is in the role's permissions
  return ROLE_PERMISSIONS[role]?.includes(action) ?? false;
}

/**
 * Checks if user can access a feature requiring minimum seniority.
 * Alias for hasMinimumSeniority for semantic clarity.
 * 
 * @param role - User's role
 * @param requiredSeniority - Minimum seniority level required
 * @returns True if role meets requirement
 */
export function canAccessBySeniority(role: UserRole, requiredSeniority: number): boolean {
  return ROLE_SENIORITY[role] >= requiredSeniority;
}

/**
 * Gets the required role for an approval step.
 * 
 * @param step - Approval step number (1, 2, or 3)
 * @returns UserRole required for that step
 */
export function getRequiredRoleForStep(step: number): UserRole {
  switch (step) {
    case 1: return 'REVIEWER';
    case 2: return 'MANAGER';
    case 3: return 'FINANCE';
    default: return 'ADMIN';
  }
}

/**
 * Gets the approval step enum for a user's role.
 * Returns null for roles not directly involved in approval workflow.
 * 
 * @param role - User's role
 * @returns ApprovalStep for the role, or null
 */
export function getApprovalStepForRole(role: UserRole): ApprovalStep | null {
  switch (role) {
    case 'REVIEWER': return 'STEP_1_REVIEWER';
    case 'MANAGER': return 'STEP_2_MANAGER';
    case 'FINANCE': return 'STEP_3_FINANCE';
    default: return null;
  }
}

// ============================================================================
// Feature Access Constants
// ============================================================================

/**
 * Minimum seniority required for each feature.
 * Use with hasMinimumSeniority() for access control.
 * 
 * @example
 * if (hasMinimumSeniority(user.role, FEATURE_SENIORITY.UPLOAD_DOCUMENTS)) {
 *   // Show upload button
 * }
 */
export const FEATURE_SENIORITY = {
  /** View documents list and details - VIEWER and above */
  VIEW_DOCUMENTS: 1,
  /** Upload new documents - REVIEWER and above */
  UPLOAD_DOCUMENTS: 2,
  /** First approval step - REVIEWER and above */
  APPROVE_STEP_1: 2,
  /** Second approval step - MANAGER and above */
  APPROVE_STEP_2: 3,
  /** Third approval step - FINANCE and above */
  APPROVE_STEP_3: 4,
  /** View AI insights dashboard - MANAGER and above */
  VIEW_INSIGHTS: 3,
  /** Export reports - REVIEWER and above */
  EXPORT_REPORTS: 2,
  /** Delete documents - ADMIN only */
  DELETE_DOCUMENTS: 5,
  /** Manage users - ADMIN only */
  MANAGE_USERS: 5,
  /** Edit any document - ADMIN only */
  EDIT_ANY_DOCUMENT: 5,
} as const;
