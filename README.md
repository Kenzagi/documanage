# DocuManage - Document Management System

A secure, enterprise-grade document management system with AI-powered data extraction, multi-level approval workflows, and comprehensive reporting capabilities. Built with Next.js 16 and designed for managing invoices and credit notes with full audit trails.

![Next.js](https://img.shields.io/badge/Next.js-16.1.1-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Prisma](https://img.shields.io/badge/Prisma-6.11-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Authentication & Authorization](#authentication--authorization)
- [Approval Workflow](#approval-workflow)
- [Deployment](#deployment)

## Overview

DocuManage streamlines the processing of financial documents (invoices and credit notes) through an intelligent, role-based approval system. The application leverages AI vision models to automatically extract key data from uploaded documents, reducing manual data entry and accelerating the approval process.

### Key Business Value

- **Reduced Processing Time**: AI-powered extraction eliminates manual data entry
- **Compliance & Audit Trail**: Complete history of all actions and approvals
- **Role-Based Security**: Granular access control with seniority-based permissions
- **Duplicate Detection**: Automatic flagging of potential duplicate submissions
- **Executive Insights**: AI-generated analysis of spending patterns and anomalies

## Features

### Document Management
- **Multi-format Support**: Upload PDF, PNG, JPG, JPEG, and WEBP files
- **AI Data Extraction**: Automatic extraction of invoice numbers, vendor details, amounts, dates, and VAT
- **Document Types**: Support for both Invoices and Credit Notes
- **Duplicate Detection**: Automatic flagging of potential duplicates based on invoice number or vendor/amount combinations

### Approval Workflow
- **3-Step Approval Process**: Reviewer → Manager → Finance
- **Role-Based Routing**: Documents automatically route to the appropriate approver
- **Comment Support**: Approvers can add comments when approving or rejecting
- **Status Tracking**: Real-time visibility into document status

### Security & Access Control
- **5-Level Role Hierarchy**: ADMIN > FINANCE > MANAGER > REVIEWER > VIEWER
- **Feature-Level Permissions**: Granular control over who can access what
- **JWT Authentication**: Secure token-based authentication with HTTP-only cookies
- **Session Management**: Automatic token expiration and refresh

### Reporting & Analytics
- **Export Capabilities**: PDF and Excel report generation
- **Spending Analysis**: Breakdown by vendor, month, and document type
- **AI Insights**: Automated analysis of spending trends and anomalies
- **Filtered Reports**: Date range, vendor, amount, and status filters

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Application                       │
│                    (Next.js App Router)                       │
├─────────────────────────────────────────────────────────────┤
│  Pages                    │  Components                      │
│  ├── Dashboard            │  ├── UI Components (shadcn/ui)   │
│  ├── Upload               │  ├── AuthProvider                │
│  ├── Documents            │  └── Feature Sections            │
│  ├── Approvals            │                                   │
│  ├── Reports              │  State Management (Zustand)      │
│  └── Insights             │                                   │
├─────────────────────────────────────────────────────────────┤
│                      API Routes                               │
├─────────────────────────────────────────────────────────────┤
│  /api/auth/*              │  /api/documents/*                │
│  ├── login                │  ├── upload                      │
│  ├── logout               │  ├── [id]                        │
│  ├── register             │  ├── submit                      │
│  └── session              │  └── [id]/extract                │
│                           │                                   │
│  /api/approvals           │  /api/export/*                   │
│                           │  ├── excel                       │
│  /api/reports             │  └── pdf                         │
│                           │                                   │
│  /api/insights            │  /api/init                       │
├─────────────────────────────────────────────────────────────┤
│                    Business Logic Layer                       │
├─────────────────────────────────────────────────────────────┤
│  Authentication           │  Document Processing             │
│  ├── JWT Token Generation │  ├── File Validation            │
│  ├── Password Hashing     │  ├── AI Extraction (Vision API) │
│  └── Session Management   │  └── Duplicate Detection        │
│                           │                                   │
│  Authorization            │  Report Generation               │
│  ├── Role Permissions     │  ├── Excel Export               │
│  └── Seniority System     │  └── PDF Generation             │
├─────────────────────────────────────────────────────────────┤
│                      Data Layer                               │
├─────────────────────────────────────────────────────────────┤
│              Prisma ORM → SQLite Database                     │
│  ┌─────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐   │
│  │  User   │  │ Document  │  │ Approval  │  │ AuditLog  │   │
│  └─────────┘  └───────────┘  └───────────┘  └───────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend
- **Next.js 16.1.1** - React framework with App Router
- **TypeScript 5** - Type-safe JavaScript
- **Tailwind CSS 4** - Utility-first CSS framework
- **shadcn/ui** - Accessible component library built on Radix UI
- **Zustand** - Lightweight state management
- **Recharts** - Composable charting library

### Backend
- **Next.js API Routes** - Serverless API endpoints
- **Prisma 6.11** - Type-safe ORM
- **SQLite** - Embedded database (development)
- **JWT** - Token-based authentication

### AI & Processing
- **z-ai-web-dev-sdk** - Vision AI for document extraction
- **ReportLab** (Python) - PDF generation
- **ExcelJS** - Excel file generation

## Getting Started

### Prerequisites

- Node.js 18+ or Bun runtime
- Python 3.8+ (for PDF generation)
- ReportLab Python package: `pip install reportlab`

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd documanage
   ```

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   DATABASE_URL="file:./dev.db"
   JWT_SECRET="your-super-secret-jwt-key-change-in-production"
   NODE_ENV="development"
   ```

4. **Initialize the database**
   ```bash
   bun run db:push
   ```

5. **Start the development server**
   ```bash
   bun run dev
   ```

6. **Access the application**
   Open [http://localhost:3000](http://localhost:3000)

### Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@example.com | admin123 |
| Finance | finance@example.com | password123 |
| Manager | manager@example.com | password123 |
| Reviewer | reviewer@example.com | password123 |
| Viewer | viewer@example.com | password123 |

## API Documentation

### Authentication

#### POST /api/auth/login
Authenticate a user and receive a session token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "clx123...",
    "email": "user@example.com",
    "name": "User Name",
    "role": "REVIEWER"
  }
}
```

#### POST /api/auth/logout
Clear the authentication session.

#### GET /api/auth/session
Get the current authenticated user's session.

### Documents

#### POST /api/documents/upload
Upload a new document with AI extraction.

**Request:** `multipart/form-data`
- `file`: Document file (PDF, PNG, JPG, JPEG, WEBP)
- `documentType`: "INVOICE" or "CREDIT_NOTE"

**Response:**
```json
{
  "success": true,
  "document": { /* Document object */ },
  "extractionResult": {
    "invoiceNumber": "INV-001",
    "vendorName": "Acme Corp",
    "totalAmount": 1500.00,
    "currency": "ZAR"
  },
  "duplicateWarning": null
}
```

#### GET /api/documents
List all documents with optional filtering.

**Query Parameters:**
- `limit`: Maximum number of results
- `status`: Filter by status
- `type`: Filter by document type

#### PUT /api/documents/[id]
Update document details.

#### DELETE /api/documents/[id]
Delete a document (ADMIN only).

#### POST /api/documents/submit
Submit a document for approval workflow.

### Approvals

#### GET /api/approvals
Get pending approvals for the current user.

#### POST /api/approvals
Process an approval (approve or reject).

**Request Body:**
```json
{
  "documentId": "clx123...",
  "action": "APPROVED",
  "comment": "Looks good"
}
```

### Reports

#### GET /api/reports
Get spending summary and analytics.

#### GET /api/export/pdf
Export report as PDF.

#### GET /api/export/excel
Export report as Excel spreadsheet.

### AI Insights

#### GET /api/insights
Get AI-generated spending insights and recommendations.

## Database Schema

### User
```prisma
model User {
  id           String      @id @default(cuid())
  email        String      @unique
  passwordHash String
  name         String
  role         UserRole    @default(VIEWER)
  isActive     Boolean     @default(true)
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt
  
  documents    Document[]
  approvals    Approval[]
  auditLogs    AuditLog[]
}
```

### Document
```prisma
model Document {
  id             String         @id @default(cuid())
  uploaderId     String
  type           DocumentType   // INVOICE, CREDIT_NOTE
  fileName       String
  filePath       String
  fileSize       Int
  mimeType       String
  
  // AI-extracted fields
  invoiceNumber  String?
  vendorName     String?
  vendorAddress  String?
  documentDate   DateTime?
  dueDate        DateTime?
  amount         Float?
  vatAmount      Float?
  totalAmount    Float?
  currency       String?
  description    String?
  
  // Workflow
  status         DocumentStatus @default(DRAFT)
  currentStep    Int            @default(1)
  
  // Duplicate detection
  isDuplicate    Boolean        @default(false)
  duplicateOfId  String?
  
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
  approvedAt     DateTime?
  rejectedAt     DateTime?
}
```

### Approval
```prisma
model Approval {
  id           String         @id @default(cuid())
  documentId   String
  approverId   String?
  step         ApprovalStep   // STEP_1_REVIEWER, STEP_2_MANAGER, STEP_3_FINANCE
  action       ApprovalAction? // APPROVED, REJECTED
  comment      String?
  createdAt    DateTime       @default(now())
  actedAt      DateTime?
}
```

## Authentication & Authorization

### Role Hierarchy

The system implements a seniority-based access control model:

| Role | Seniority Level | Capabilities |
|------|-----------------|--------------|
| ADMIN | 5 | Full system access, user management, delete documents |
| FINANCE | 4 | Final approval step, export reports, view insights |
| MANAGER | 3 | Second approval step, export reports, view insights |
| REVIEWER | 2 | First approval step, upload documents, export reports |
| VIEWER | 1 | View documents only |

### Permission Matrix

| Feature | ADMIN | FINANCE | MANAGER | REVIEWER | VIEWER |
|---------|-------|---------|---------|----------|--------|
| View Documents | ✅ | ✅ | ✅ | ✅ | ✅ |
| Upload Documents | ✅ | ✅ | ✅ | ✅ | ❌ |
| Approve (Step 1) | ✅ | ❌ | ❌ | ✅ | ❌ |
| Approve (Step 2) | ✅ | ❌ | ✅ | ❌ | ❌ |
| Approve (Step 3) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Export Reports | ✅ | ✅ | ✅ | ✅ | ❌ |
| View Insights | ✅ | ✅ | ✅ | ❌ | ❌ |
| Delete Documents | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage Users | ✅ | ❌ | ❌ | ❌ | ❌ |

### Authentication Flow

1. User submits credentials to `/api/auth/login`
2. Server validates credentials and generates JWT token
3. Token stored in HTTP-only cookie (secure, same-site)
4. Subsequent requests include cookie automatically
5. Server validates token on each protected route
6. Token expires after 24 hours

## Approval Workflow

### Process Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Document Lifecycle                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [Upload] → [DRAFT] → [Submit for Approval]                 │
│                              │                               │
│                              ▼                               │
│                    ┌─────────────────┐                       │
│                    │ PENDING_REVIEWER │◄──── Reviewer        │
│                    └────────┬────────┘                       │
│                             │                                │
│              Approve ───────┼─────── Reject                  │
│                │            │           │                    │
│                ▼            │           ▼                    │
│      ┌──────────────────┐   │    ┌─────────────┐            │
│      │ PENDING_MANAGER  │◄──┘    │  REJECTED   │            │
│      └────────┬─────────┘        └─────────────┘            │
│               │                                              │
│    Approve ───┼─── Reject                                     │
│      │        │         │                                    │
│      ▼        │         ▼                                    │
│ ┌─────────────┴──┐   ┌─────────────┐                        │
│ │PENDING_FINANCE │   │  REJECTED   │                        │
│ └────────┬───────┘   └─────────────┘                        │
│          │                                                   │
│   Approve┼Reject                                             │
│     │    │                                                   │
│     ▼    ▼                                                   │
│ ┌─────────────┐                                              │
│ │  APPROVED   │                                              │
│ └─────────────┘                                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Status Definitions

| Status | Description |
|--------|-------------|
| DRAFT | Newly uploaded, not yet submitted |
| PENDING_REVIEWER | Awaiting first-level approval |
| PENDING_MANAGER | Passed reviewer, awaiting manager approval |
| PENDING_FINANCE | Passed manager, awaiting finance approval |
| APPROVED | Fully approved, included in reports |
| REJECTED | Rejected at any step |

## Deployment

### Vercel Deployment (Recommended)

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-github-repo>
   git push -u origin main
   ```

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Configure environment variables:
     - `DATABASE_URL` - PostgreSQL connection string
     - `JWT_SECRET` - Secure random string

3. **Deploy**
   - Vercel will automatically build and deploy

### Environment Variables for Production

```env
# Database (use PostgreSQL for production)
DATABASE_URL="postgresql://user:password@host:5432/documanage"

# Authentication
JWT_SECRET="your-very-long-secure-random-string-at-least-32-characters"

# Environment
NODE_ENV="production"
```

### Production Database Setup

For production, migrate from SQLite to PostgreSQL:

1. Update `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

2. Run migration:
   ```bash
   bun run db:migrate
   ```

### File Storage Considerations

In production, consider using cloud storage:
- **AWS S3** - Industry standard
- **Cloudflare R2** - S3-compatible, no egress fees
- **Vercel Blob** - Native Vercel integration

---

## License

This project is licensed under the MIT License.

---

Built with modern web technologies. Designed for enterprise document management.
