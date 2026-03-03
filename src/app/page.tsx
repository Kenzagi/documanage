'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Upload, FileText, BarChart3, Brain, LogOut, User, CheckCircle, XCircle, 
  Clock, AlertTriangle, TrendingUp, TrendingDown, DollarSign, FileSpreadsheet,
  Download, Eye, Loader2, AlertCircle, CheckCircle2, X, 
  FileUp, Building2, Receipt, Calendar, 
  ThumbsUp, ThumbsDown, Edit, Trash2, LayoutDashboard, FileCheck,
  Sparkles, ClipboardList, ChevronRight, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import type { DocumentWithUploader, AIInsight, SpendSummary, UserRole } from '@/types';
import { ROLE_SENIORITY, FEATURE_SENIORITY, hasMinimumSeniority, getSeniorityLevel } from '@/types';
import { DocumentStatus, DocumentType, ApprovalAction, ApprovalStep } from '@prisma/client';

// Extraction result type
interface ExtractionResultData {
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

// Currency formatting helper - defaults to ZAR (South African Rand)
function formatCurrency(amount: number | null | undefined, currency?: string | null): string {
  if (amount === null || amount === undefined) return 'R0.00';
  return `R${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ==================== LOGIN PAGE ====================
function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore(state => state.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    const result = await login(email, password);
    
    if (!result.success) {
      setError(result.error || 'Login failed');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 bg-[#3b82f6] rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-bold text-white">DocuManage</span>
        </div>

        {/* Login Card */}
        <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#2a2a2a]">
          <h1 className="text-xl font-semibold text-white mb-1">Sign In</h1>
          <p className="text-[#888] text-sm mb-6">Enter your credentials to access your account</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-lg p-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-[#ef4444]" />
                <span className="text-[#ef4444] text-sm">{error}</span>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[#888] text-sm">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 bg-[#0f0f0f] border-[#2a2a2a] text-white placeholder:text-[#555] focus:border-[#3b82f6] focus:ring-0"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[#888] text-sm">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 bg-[#0f0f0f] border-[#2a2a2a] text-white placeholder:text-[#555] focus:border-[#3b82f6] focus:ring-0"
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full h-11 bg-[#3b82f6] hover:bg-[#2563eb] text-white font-medium" 
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign In'}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-[#0f0f0f] rounded-lg">
            <p className="text-[#888] text-xs mb-2">Demo Accounts:</p>
            <div className="grid grid-cols-1 gap-1 text-xs text-[#666]">
              <p>Admin: admin@example.com / admin123</p>
              <p>Finance: finance@example.com / password123</p>
              <p>Manager: manager@example.com / password123</p>
              <p>Reviewer: reviewer@example.com / password123</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== SIDEBAR ====================
interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: { name: string; role: string; email: string } | null;
  logout: () => Promise<void>;
}

function Sidebar({ activeTab, setActiveTab, user, logout }: SidebarProps) {
  const canAccess = (tab: string) => {
    if (!user) return false;
    switch (tab) {
      case 'upload': return hasMinimumSeniority(user.role as UserRole, FEATURE_SENIORITY.UPLOAD_DOCUMENTS);
      case 'approvals': return hasMinimumSeniority(user.role as UserRole, FEATURE_SENIORITY.APPROVE_STEP_1);
      case 'reports': return hasMinimumSeniority(user.role as UserRole, FEATURE_SENIORITY.EXPORT_REPORTS);
      case 'insights': return hasMinimumSeniority(user.role as UserRole, FEATURE_SENIORITY.VIEW_INSIGHTS);
      default: return true;
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'upload', label: 'Upload', icon: Upload, requiresPermission: true },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'approvals', label: 'Approvals', icon: ClipboardList, requiresPermission: true },
    { id: 'reports', label: 'Reports', icon: BarChart3, requiresPermission: true },
    { id: 'insights', label: 'Insights', icon: Sparkles, requiresPermission: true },
  ];

  const filteredNavItems = navItems.filter(item => !item.requiresPermission || canAccess(item.id));

  return (
    <aside className="w-64 bg-[#0f0f0f] text-white flex flex-col h-screen fixed left-0 top-0 z-50 border-r border-[#1a1a1a]">
      {/* Logo */}
      <div className="p-5 border-b border-[#1a1a1a]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#3b82f6] rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">DocuManage</h1>
            <p className="text-[10px] text-[#555] uppercase tracking-wider">Document Management</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {filteredNavItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === item.id
                ? 'bg-[#3b82f6] text-white'
                : 'text-[#888] hover:bg-[#1a1a1a] hover:text-white'
            }`}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </button>
        ))}
      </nav>

      {/* User Profile */}
      <div className="p-3 border-t border-[#1a1a1a]">
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#1a1a1a] cursor-pointer">
          <div className="w-9 h-9 bg-[#1a1a1a] rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-[#888]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-[#555] truncate">{user?.role}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          className="w-full mt-2 text-[#888] hover:text-white hover:bg-[#1a1a1a] justify-start"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}

// ==================== DASHBOARD ====================
function Dashboard() {
  const [stats, setStats] = useState({
    totalDocuments: 0,
    pendingApprovals: 0,
    approvedThisMonth: 0,
    totalAmount: 0,
  });
  const [recentDocs, setRecentDocs] = useState<DocumentWithUploader[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [docsRes, approvalsRes, reportsRes] = await Promise.all([
          fetch('/api/documents?limit=1000'),
          fetch('/api/approvals'),
          fetch('/api/reports'),
        ]);
        
        const docsData = await docsRes.json();
        const approvalsData = await approvalsRes.json();
        const reportsData = await reportsRes.json();
        
        if (docsData.success) {
          setStats({
            totalDocuments: docsData.documents?.length || 0,
            pendingApprovals: approvalsData.approvals?.length || 0,
            approvedThisMonth: reportsData.data?.approvedCount || 0,
            totalAmount: reportsData.data?.totalAmount || 0,
          });
          setRecentDocs(docsData.documents?.slice(0, 5) || []);
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchStats();
  }, []);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      DRAFT: 'bg-[#374151] text-[#9ca3af]',
      PENDING_REVIEWER: 'bg-[#92400e] text-[#fcd34d]',
      PENDING_MANAGER: 'bg-[#1e3a5f] text-[#60a5fa]',
      PENDING_FINANCE: 'bg-[#581c87] text-[#c084fc]',
      APPROVED: 'bg-[#166534] text-[#4ade80]',
      REJECTED: 'bg-[#7f1d1d] text-[#f87171]',
    };
    const labels: Record<string, string> = {
      DRAFT: 'Draft',
      PENDING_REVIEWER: 'Pending Review',
      PENDING_MANAGER: 'Pending Manager',
      PENDING_FINANCE: 'Pending Finance',
      APPROVED: 'Approved',
      REJECTED: 'Rejected',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-700 text-gray-300'}`}>
        {labels[status] || status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-[#666] text-sm">Welcome back! Here&apos;s an overview of your invoices.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#1a1a1a] rounded-xl p-5 border border-[#2a2a2a]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#888] text-sm font-medium">Total Revenue</p>
              <p className="text-2xl font-bold text-white mt-1">
                {loading ? 'R0.00' : formatCurrency(stats.totalAmount)}
              </p>
              <p className="text-[#4ade80] text-xs mt-1 flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3" />
                <span>From approved invoices</span>
              </p>
            </div>
            <div className="w-10 h-10 bg-[#3b82f6]/10 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-[#3b82f6]" />
            </div>
          </div>
        </div>

        <div className="bg-[#1a1a1a] rounded-xl p-5 border border-[#2a2a2a]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#888] text-sm font-medium">Approved Invoices</p>
              <p className="text-2xl font-bold text-white mt-1">
                {loading ? '0' : stats.approvedThisMonth}
              </p>
              <p className="text-[#4ade80] text-xs mt-1 flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3" />
                <span>Fully approved</span>
              </p>
            </div>
            <div className="w-10 h-10 bg-[#4ade80]/10 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-[#4ade80]" />
            </div>
          </div>
        </div>

        <div className="bg-[#1a1a1a] rounded-xl p-5 border border-[#2a2a2a]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#888] text-sm font-medium">Pending Invoices</p>
              <p className="text-2xl font-bold text-white mt-1">
                {loading ? '0' : stats.pendingApprovals}
              </p>
              <p className="text-[#fcd34d] text-xs mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Awaiting approval</span>
              </p>
            </div>
            <div className="w-10 h-10 bg-[#fcd34d]/10 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-[#fcd34d]" />
            </div>
          </div>
        </div>

        <div className="bg-[#1a1a1a] rounded-xl p-5 border border-[#2a2a2a]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#888] text-sm font-medium">Total Invoices</p>
              <p className="text-2xl font-bold text-white mt-1">
                {loading ? '0' : stats.totalDocuments}
              </p>
              <p className="text-[#888] text-xs mt-1 flex items-center gap-1">
                <FileText className="w-3 h-3" />
                <span>All documents</span>
              </p>
            </div>
            <div className="w-10 h-10 bg-[#a855f7]/10 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-[#a855f7]" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Invoices Table */}
      <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a]">
        <div className="p-5 border-b border-[#2a2a2a] flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Recent Invoices</h2>
            <p className="text-[#666] text-sm">Latest uploaded documents</p>
          </div>
          <Button variant="ghost" size="sm" className="text-[#888] hover:text-white">
            View All
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#3b82f6]" />
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  <th className="text-left p-4 text-xs font-medium text-[#666] uppercase tracking-wider">Invoice #</th>
                  <th className="text-left p-4 text-xs font-medium text-[#666] uppercase tracking-wider">Vendor</th>
                  <th className="text-left p-4 text-xs font-medium text-[#666] uppercase tracking-wider">Amount</th>
                  <th className="text-left p-4 text-xs font-medium text-[#666] uppercase tracking-wider">Status</th>
                  <th className="text-left p-4 text-xs font-medium text-[#666] uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentDocs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-[#666]">No invoices found</td>
                  </tr>
                ) : (
                  recentDocs.map((doc) => (
                    <tr key={doc.id} className="border-b border-[#2a2a2a] last:border-0 hover:bg-[#0f0f0f]">
                      <td className="p-4 text-sm font-mono text-white">{doc.invoiceNumber || 'N/A'}</td>
                      <td className="p-4 text-sm text-[#ccc]">{doc.vendorName || 'N/A'}</td>
                      <td className="p-4 text-sm font-medium text-white">{formatCurrency(doc.totalAmount, doc.currency)}</td>
                      <td className="p-4">{getStatusBadge(doc.status)}</td>
                      <td className="p-4 text-sm text-[#888]">{new Date(doc.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== UPLOAD SECTION ====================
function UploadSection() {
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<'INVOICE' | 'CREDIT_NOTE' | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ document: DocumentWithUploader; extractionResult?: ExtractionResultData | null; duplicateWarning?: { type: string; existingDocumentId: string } | null; extractionError?: string } | null>(null);
  const [error, setError] = useState('');

  const handleUpload = async () => {
    if (!file || !documentType) return;
    
    setUploading(true);
    setError('');
    setResult(null);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentType', documentType);
    
    try {
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      
      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || 'Upload failed');
      }
    } catch {
      setError('An error occurred during upload');
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setDocumentType(null);
    setResult(null);
    setError('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Upload Document</h1>
        <p className="text-[#666] text-sm">Upload invoices or credit notes for AI-powered extraction</p>
      </div>

      {/* Step 1: Select Document Type */}
      {!documentType && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-[#888]">
            <span className="w-6 h-6 rounded-full bg-[#3b82f6] text-white text-sm flex items-center justify-center font-medium">1</span>
            <span className="text-sm font-medium">Select Document Type</span>
          </div>
          
          <p className="text-[#666] text-sm">Please select the type of document you want to upload before proceeding.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Invoice Card */}
            <button
              onClick={() => setDocumentType('INVOICE')}
              className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] p-6 text-left hover:border-[#3b82f6] hover:bg-[#1a1a1a]/80 transition-all group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-[#3b82f6]/10 rounded-lg flex items-center justify-center group-hover:bg-[#3b82f6]/20 transition-colors">
                  <FileText className="w-6 h-6 text-[#3b82f6]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-1">Invoice</h3>
                  <p className="text-[#888] text-sm mb-3">A bill sent by a vendor requesting payment for goods or services provided.</p>
                  <div className="space-y-1">
                    <p className="text-[#666] text-xs">Examples:</p>
                    <p className="text-[#555] text-xs">• Tax invoice from supplier</p>
                    <p className="text-[#555] text-xs">• Service billing statement</p>
                    <p className="text-[#555] text-xs">• Purchase invoice</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-[#2a2a2a] flex items-center justify-between">
                <span className="text-[#3b82f6] text-sm font-medium">Select this type</span>
                <ChevronRight className="w-4 h-4 text-[#3b82f6]" />
              </div>
            </button>

            {/* Credit Note Card */}
            <button
              onClick={() => setDocumentType('CREDIT_NOTE')}
              className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] p-6 text-left hover:border-[#a855f7] hover:bg-[#1a1a1a]/80 transition-all group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-[#a855f7]/10 rounded-lg flex items-center justify-center group-hover:bg-[#a855f7]/20 transition-colors">
                  <Receipt className="w-6 h-6 text-[#a855f7]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-1">Credit Note</h3>
                  <p className="text-[#888] text-sm mb-3">A document issued by a vendor to reduce the amount owed, typically for returns or corrections.</p>
                  <div className="space-y-1">
                    <p className="text-[#666] text-xs">Examples:</p>
                    <p className="text-[#555] text-xs">• Returned goods credit</p>
                    <p className="text-[#555] text-xs">• Price adjustment note</p>
                    <p className="text-[#555] text-xs">• Refund documentation</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-[#2a2a2a] flex items-center justify-between">
                <span className="text-[#a855f7] text-sm font-medium">Select this type</span>
                <ChevronRight className="w-4 h-4 text-[#a855f7]" />
              </div>
            </button>
          </div>

          <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#2a2a2a] flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[#fcd34d] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[#fcd34d] text-sm font-medium">Important</p>
              <p className="text-[#888] text-xs mt-1">Selecting the correct document type ensures accurate AI extraction and proper processing through the approval workflow.</p>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Upload File */}
      {documentType && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upload Form */}
          <div className="space-y-4">
            {/* Progress Steps */}
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#4ade80] text-white text-sm flex items-center justify-center font-medium">
                <CheckCircle2 className="w-4 h-4" />
              </span>
              <span className="text-[#4ade80] text-sm font-medium">
                {documentType === 'INVOICE' ? 'Invoice' : 'Credit Note'} selected
              </span>
            </div>
            
            <div className="flex items-center gap-2 text-[#888]">
              <span className="w-6 h-6 rounded-full bg-[#3b82f6] text-white text-sm flex items-center justify-center font-medium">2</span>
              <span className="text-sm font-medium">Upload Your Document</span>
            </div>

            <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a]">
              <div className="p-5 border-b border-[#2a2a2a]">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-white">Select File</h2>
                    <p className="text-[#666] text-sm">Supported: PDF, PNG, JPG, JPEG, WEBP (max 10MB)</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleReset}
                    className="text-[#888] hover:text-white hover:bg-[#2a2a2a] h-8"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Change Type
                  </Button>
                </div>
              </div>
              <div className="p-5 space-y-4">
                {/* Selected Type Badge */}
                <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg ${documentType === 'INVOICE' ? 'bg-[#3b82f6]/10 border border-[#3b82f6]/20' : 'bg-[#a855f7]/10 border border-[#a855f7]/20'}`}>
                  {documentType === 'INVOICE' ? (
                    <>
                      <FileText className="w-4 h-4 text-[#3b82f6]" />
                      <span className="text-[#3b82f6] text-sm font-medium">Invoice</span>
                    </>
                  ) : (
                    <>
                      <Receipt className="w-4 h-4 text-[#a855f7]" />
                      <span className="text-[#a855f7] text-sm font-medium">Credit Note</span>
                    </>
                  )}
                </div>

                <div 
                  className="border-2 border-dashed border-[#2a2a2a] rounded-lg p-8 text-center hover:border-[#3b82f6] transition-colors cursor-pointer"
                  onClick={() => document.getElementById('fileInput')?.click()}
                >
                  <input
                    id="fileInput"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                  {file ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileText className="w-8 h-8 text-[#3b82f6]" />
                      <div className="text-left">
                        <p className="font-medium text-white">{file.name}</p>
                        <p className="text-sm text-[#666]">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-10 h-10 text-[#444] mx-auto mb-3" />
                      <p className="font-medium text-white">Click to upload or drag and drop</p>
                      <p className="text-sm text-[#666] mt-1">PDF, PNG, JPG up to 10MB</p>
                    </>
                  )}
                </div>

                {error && (
                  <div className="bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-lg p-3 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-[#ef4444]" />
                    <span className="text-[#ef4444] text-sm">{error}</span>
                  </div>
                )}

                <Button 
                  onClick={handleUpload} 
                  disabled={!file || uploading}
                  className="w-full h-10 bg-[#3b82f6] hover:bg-[#2563eb] text-white font-medium"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload & Extract
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Extraction Results */}
          <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a]">
            <div className="p-5 border-b border-[#2a2a2a]">
              <h2 className="text-base font-semibold text-white">Extraction Results</h2>
              <p className="text-[#666] text-sm">AI-extracted data from your document</p>
            </div>
            <div className="p-5">
              {!result ? (
                <div className="text-center py-12">
                  <FileText className="w-10 h-10 text-[#333] mx-auto mb-3" />
                  <p className="text-[#666]">Upload a document to see extracted data</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {result.duplicateWarning && (
                    <div className="bg-[#fcd34d]/10 border border-[#fcd34d]/20 rounded-lg p-3 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-[#fcd34d]" />
                      <span className="text-[#fcd34d] text-sm">This document may be a duplicate</span>
                    </div>
                  )}

                  {result.extractionResult && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs text-[#666]">Invoice Number</p>
                        <p className="text-sm text-white">{result.extractionResult.invoiceNumber || 'Not found'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-[#666]">Vendor</p>
                        <p className="text-sm text-white">{result.extractionResult.vendorName || 'Not found'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-[#666]">Document Date</p>
                        <p className="text-sm text-white">{result.extractionResult.documentDate || 'Not found'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-[#666]">Due Date</p>
                        <p className="text-sm text-white">{result.extractionResult.dueDate || 'Not found'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-[#666]">Subtotal</p>
                        <p className="text-sm text-white">{formatCurrency(result.extractionResult.amount, result.extractionResult.currency)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-[#666]">VAT</p>
                        <p className="text-sm text-white">{formatCurrency(result.extractionResult.vatAmount, result.extractionResult.currency)}</p>
                      </div>
                      <div className="space-y-1 col-span-2">
                        <p className="text-xs text-[#666]">Total Amount</p>
                        <p className="text-lg font-semibold text-[#4ade80]">{formatCurrency(result.extractionResult.totalAmount, result.extractionResult.currency)}</p>
                      </div>
                      <div className="space-y-1 col-span-2">
                        <p className="text-xs text-[#666]">Currency</p>
                        <p className="text-sm text-white">{result.extractionResult.currency || 'ZAR'}</p>
                      </div>
                    </div>
                  )}
                  
                  {result.document && (
                    <div className="pt-4 border-t border-[#2a2a2a]">
                      <Button 
                        onClick={handleReset}
                        variant="outline" 
                        className="w-full bg-transparent border-[#2a2a2a] text-white hover:bg-[#2a2a2a]"
                      >
                        Upload Another Document
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== DOCUMENTS SECTION ====================
function DocumentsSection() {
  const [documents, setDocuments] = useState<DocumentWithUploader[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<DocumentWithUploader | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    invoiceNumber: '',
    vendorName: '',
    vendorAddress: '',
    documentDate: '',
    dueDate: '',
    amount: '',
    vatAmount: '',
    totalAmount: '',
    currency: '',
    description: '',
  });
  const user = useAuthStore(state => state.user);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/documents?limit=1000');
      const data = await response.json();
      if (data.success) {
        setDocuments(data.documents);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleViewDetails = (doc: DocumentWithUploader) => {
    setSelectedDoc(doc);
    setShowDetails(true);
  };

  const handleOpenEdit = (doc: DocumentWithUploader) => {
    setSelectedDoc(doc);
    setEditForm({
      invoiceNumber: doc.invoiceNumber || '',
      vendorName: doc.vendorName || '',
      vendorAddress: doc.vendorAddress || '',
      documentDate: doc.documentDate ? new Date(doc.documentDate).toISOString().split('T')[0] : '',
      dueDate: doc.dueDate ? new Date(doc.dueDate).toISOString().split('T')[0] : '',
      amount: doc.amount?.toString() || '',
      vatAmount: doc.vatAmount?.toString() || '',
      totalAmount: doc.totalAmount?.toString() || '',
      currency: doc.currency || 'ZAR',
      description: doc.description || '',
    });
    setShowEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedDoc) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/documents/${selectedDoc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceNumber: editForm.invoiceNumber || null,
          vendorName: editForm.vendorName || null,
          vendorAddress: editForm.vendorAddress || null,
          documentDate: editForm.documentDate || null,
          dueDate: editForm.dueDate || null,
          amount: editForm.amount ? parseFloat(editForm.amount) : null,
          vatAmount: editForm.vatAmount ? parseFloat(editForm.vatAmount) : null,
          totalAmount: editForm.totalAmount ? parseFloat(editForm.totalAmount) : null,
          currency: editForm.currency || null,
          description: editForm.description || null,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setShowEditDialog(false);
        fetchDocuments();
      }
    } catch (error) {
      console.error('Error saving document:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedDoc) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/documents/${selectedDoc.id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.success) {
        setShowDeleteDialog(false);
        fetchDocuments();
      }
    } catch (error) {
      console.error('Error deleting document:', error);
    } finally {
      setDeleting(false);
    }
  };

  const handleSubmitForApproval = async (docId: string) => {
    try {
      const response = await fetch('/api/documents/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: docId }),
      });
      const data = await response.json();
      if (data.success) {
        fetchDocuments();
      }
    } catch (error) {
      console.error('Error submitting for approval:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      DRAFT: 'bg-[#374151] text-[#9ca3af]',
      PENDING_REVIEWER: 'bg-[#92400e] text-[#fcd34d]',
      PENDING_MANAGER: 'bg-[#1e3a5f] text-[#60a5fa]',
      PENDING_FINANCE: 'bg-[#581c87] text-[#c084fc]',
      APPROVED: 'bg-[#166534] text-[#4ade80]',
      REJECTED: 'bg-[#7f1d1d] text-[#f87171]',
    };
    const labels: Record<string, string> = {
      DRAFT: 'Draft',
      PENDING_REVIEWER: 'Pending Review',
      PENDING_MANAGER: 'Pending Manager',
      PENDING_FINANCE: 'Pending Finance',
      APPROVED: 'Approved',
      REJECTED: 'Rejected',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-700 text-gray-300'}`}>
        {labels[status] || status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Documents</h1>
          <p className="text-[#666] text-sm">Manage your invoices and credit notes</p>
        </div>
      </div>

      <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a]">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#3b82f6]" />
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-10 h-10 text-[#333] mx-auto mb-3" />
              <p className="text-[#666]">No documents found</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  <th className="text-left p-4 text-xs font-medium text-[#666] uppercase tracking-wider">Invoice #</th>
                  <th className="text-left p-4 text-xs font-medium text-[#666] uppercase tracking-wider">Vendor</th>
                  <th className="text-left p-4 text-xs font-medium text-[#666] uppercase tracking-wider">Type</th>
                  <th className="text-left p-4 text-xs font-medium text-[#666] uppercase tracking-wider">Amount</th>
                  <th className="text-left p-4 text-xs font-medium text-[#666] uppercase tracking-wider">Status</th>
                  <th className="text-left p-4 text-xs font-medium text-[#666] uppercase tracking-wider">Date</th>
                  <th className="text-right p-4 text-xs font-medium text-[#666] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} className="border-b border-[#2a2a2a] last:border-0 hover:bg-[#0f0f0f]">
                    <td className="p-4 text-sm font-mono text-white">{doc.invoiceNumber || 'N/A'}</td>
                    <td className="p-4 text-sm text-[#ccc]">{doc.vendorName || 'N/A'}</td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-[#374151] text-[#9ca3af]">{doc.type}</span>
                    </td>
                    <td className="p-4 text-sm font-medium text-white">{formatCurrency(doc.totalAmount, doc.currency)}</td>
                    <td className="p-4">{getStatusBadge(doc.status)}</td>
                    <td className="p-4 text-sm text-[#888]">{new Date(doc.createdAt).toLocaleDateString()}</td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-[#888] hover:text-white hover:bg-[#2a2a2a]" onClick={() => handleViewDetails(doc)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {(doc.status === 'DRAFT' || hasMinimumSeniority(user?.role as UserRole, FEATURE_SENIORITY.EDIT_ANY_DOCUMENT)) && (
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-[#888] hover:text-white hover:bg-[#2a2a2a]" onClick={() => handleOpenEdit(doc)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {doc.status === 'DRAFT' && (
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-[#3b82f6] hover:text-[#60a5fa] hover:bg-[#2a2a2a]" onClick={() => handleSubmitForApproval(doc.id)}>
                            <FileCheck className="h-4 w-4" />
                          </Button>
                        )}
                        {hasMinimumSeniority(user?.role as UserRole, FEATURE_SENIORITY.DELETE_DOCUMENTS) && (
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-[#ef4444] hover:text-[#f87171] hover:bg-[#2a2a2a]" onClick={() => { setSelectedDoc(doc); setShowDeleteDialog(true); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* View Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-lg bg-[#1a1a1a] border-[#2a2a2a] text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Document Details</DialogTitle>
            <DialogDescription className="text-[#666]">{selectedDoc?.invoiceNumber || 'Document'}</DialogDescription>
          </DialogHeader>
          {selectedDoc && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[#666] text-xs">Invoice Number</Label>
                <p className="text-sm text-white mt-1">{selectedDoc.invoiceNumber || 'N/A'}</p>
              </div>
              <div>
                <Label className="text-[#666] text-xs">Vendor</Label>
                <p className="text-sm text-white mt-1">{selectedDoc.vendorName || 'N/A'}</p>
              </div>
              <div>
                <Label className="text-[#666] text-xs">Amount</Label>
                <p className="text-sm text-white mt-1">{formatCurrency(selectedDoc.totalAmount, selectedDoc.currency)}</p>
              </div>
              <div>
                <Label className="text-[#666] text-xs">Status</Label>
                <div className="mt-1">{getStatusBadge(selectedDoc.status)}</div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetails(false)} className="bg-transparent border-[#2a2a2a] text-white hover:bg-[#2a2a2a]">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg bg-[#1a1a1a] border-[#2a2a2a] text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Document</DialogTitle>
            <DialogDescription className="text-[#666]">Update document information</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[#888] text-sm">Invoice Number</Label>
              <Input value={editForm.invoiceNumber} onChange={(e) => setEditForm({ ...editForm, invoiceNumber: e.target.value })} className="bg-[#0f0f0f] border-[#2a2a2a] text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-[#888] text-sm">Vendor Name</Label>
              <Input value={editForm.vendorName} onChange={(e) => setEditForm({ ...editForm, vendorName: e.target.value })} className="bg-[#0f0f0f] border-[#2a2a2a] text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-[#888] text-sm">Total Amount</Label>
              <Input type="number" step="0.01" value={editForm.totalAmount} onChange={(e) => setEditForm({ ...editForm, totalAmount: e.target.value })} className="bg-[#0f0f0f] border-[#2a2a2a] text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-[#888] text-sm">Currency</Label>
              <Select value={editForm.currency} onValueChange={(v) => setEditForm({ ...editForm, currency: v })}>
                <SelectTrigger className="bg-[#0f0f0f] border-[#2a2a2a] text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
                  <SelectItem value="ZAR" className="text-white">ZAR (R)</SelectItem>
                  <SelectItem value="USD" className="text-white">USD ($)</SelectItem>
                  <SelectItem value="EUR" className="text-white">EUR (€)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)} className="bg-transparent border-[#2a2a2a] text-white hover:bg-[#2a2a2a]">Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={saving} className="bg-[#3b82f6] hover:bg-[#2563eb] text-white">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-sm bg-[#1a1a1a] border-[#2a2a2a] text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Document</DialogTitle>
            <DialogDescription className="text-[#666]">Are you sure? This cannot be undone.</DialogDescription>
          </DialogHeader>
          {selectedDoc && (
            <div className="space-y-1 py-2 text-sm">
              <p className="text-[#ccc]"><span className="text-[#666]">Invoice:</span> {selectedDoc.invoiceNumber || 'N/A'}</p>
              <p className="text-[#ccc]"><span className="text-[#666]">Vendor:</span> {selectedDoc.vendorName || 'N/A'}</p>
              <p className="text-[#ccc]"><span className="text-[#666]">Amount:</span> {formatCurrency(selectedDoc.totalAmount, selectedDoc.currency)}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} className="bg-transparent border-[#2a2a2a] text-white hover:bg-[#2a2a2a]">Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="bg-[#ef4444] hover:bg-[#dc2626]">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== APPROVALS SECTION ====================
function ApprovalsSection() {
  const [approvals, setApprovals] = useState<Array<{ document: DocumentWithUploader; id: string; step: ApprovalStep }>>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<typeof approvals[0] | null>(null);

  const fetchApprovals = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/approvals');
      const data = await response.json();
      if (data.success) {
        setApprovals(data.approvals);
      }
    } catch (error) {
      console.error('Error fetching approvals:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  const handleApproval = async (action: 'APPROVED' | 'REJECTED') => {
    if (!selectedApproval) return;
    setProcessingId(selectedApproval.id);
    try {
      const response = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: selectedApproval.document.id,
          action,
          comment,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setShowApprovalDialog(false);
        setComment('');
        fetchApprovals();
      }
    } catch (error) {
      console.error('Error processing approval:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const getStepName = (step: string) => {
    const names: Record<string, string> = {
      STEP_1_REVIEWER: 'Reviewer',
      STEP_2_MANAGER: 'Manager',
      STEP_3_FINANCE: 'Finance',
    };
    return names[step] || step;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Pending Approvals</h1>
        <p className="text-[#666] text-sm">Review and approve pending documents</p>
      </div>

      <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a]">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-[#3b82f6]" />
          </div>
        ) : approvals.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="w-10 h-10 text-[#166534] mx-auto mb-3" />
            <p className="text-white font-medium">All caught up!</p>
            <p className="text-[#666] text-sm">No pending approvals</p>
          </div>
        ) : (
          <div className="divide-y divide-[#2a2a2a]">
            {approvals.map((approval) => (
              <div key={approval.id} className="p-4 hover:bg-[#0f0f0f] flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-[#3b82f6]/10 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-[#3b82f6]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-white">{approval.document.vendorName || 'Unknown'}</p>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-[#374151] text-[#9ca3af]">{getStepName(approval.step)}</span>
                    </div>
                    <p className="text-sm text-[#666]">Invoice: {approval.document.invoiceNumber || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <p className="font-semibold text-white">{formatCurrency(approval.document.totalAmount, approval.document.currency)}</p>
                  <Button onClick={() => { setSelectedApproval(approval); setShowApprovalDialog(true); }} className="bg-[#3b82f6] hover:bg-[#2563eb] text-white h-9">
                    Review
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent className="max-w-sm bg-[#1a1a1a] border-[#2a2a2a] text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Review Document</DialogTitle>
            <DialogDescription className="text-[#666]">{selectedApproval?.document.invoiceNumber || 'Document'}</DialogDescription>
          </DialogHeader>
          {selectedApproval && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[#666] text-xs">Vendor</p>
                  <p className="text-white">{selectedApproval.document.vendorName || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[#666] text-xs">Amount</p>
                  <p className="text-white">{formatCurrency(selectedApproval.document.totalAmount, selectedApproval.document.currency)}</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[#888] text-sm">Comment (optional)</Label>
                <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment..." className="bg-[#0f0f0f] border-[#2a2a2a] text-white placeholder:text-[#444]" />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowApprovalDialog(false)} className="bg-transparent border-[#2a2a2a] text-white hover:bg-[#2a2a2a]">Cancel</Button>
            <Button variant="destructive" onClick={() => handleApproval('REJECTED')} disabled={!!processingId} className="bg-[#ef4444] hover:bg-[#dc2626] text-white">
              <ThumbsDown className="w-4 h-4 mr-1" /> Reject
            </Button>
            <Button onClick={() => handleApproval('APPROVED')} disabled={!!processingId} className="bg-[#4ade80] hover:bg-[#22c55e] text-black">
              <ThumbsUp className="w-4 h-4 mr-1" /> Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== REPORTS SECTION ====================
function ReportsSection() {
  const [report, setReport] = useState<SpendSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const response = await fetch('/api/reports');
        const data = await response.json();
        if (data.success) {
          setReport(data.data);
        }
      } catch (error) {
        console.error('Error fetching report:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, []);

  const handleExport = async (type: 'excel' | 'pdf') => {
    setExporting(true);
    try {
      const response = await fetch(`/api/export/${type}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report.${type === 'excel' ? 'xlsx' : 'pdf'}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-[#3b82f6]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Reports</h1>
          <p className="text-[#666] text-sm">Financial summary (Approved documents only)</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => handleExport('excel')} disabled={exporting} variant="outline" className="bg-transparent border-[#2a2a2a] text-white hover:bg-[#2a2a2a]">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
            Export Excel
          </Button>
          <Button onClick={() => handleExport('pdf')} disabled={exporting} variant="outline" className="bg-transparent border-[#2a2a2a] text-white hover:bg-[#2a2a2a]">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
            Export PDF
          </Button>
        </div>
      </div>

      {report && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#1a1a1a] rounded-xl p-5 border border-[#2a2a2a]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#888] text-sm font-medium">Total Amount</p>
                  <p className="text-2xl font-bold text-white mt-1">{formatCurrency(report.totalAmount)}</p>
                </div>
                <div className="w-10 h-10 bg-[#a855f7]/10 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-[#a855f7]" />
                </div>
              </div>
            </div>
            <div className="bg-[#1a1a1a] rounded-xl p-5 border border-[#2a2a2a]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#888] text-sm font-medium">Total VAT</p>
                  <p className="text-2xl font-bold text-white mt-1">{formatCurrency(report.totalVat)}</p>
                </div>
                <div className="w-10 h-10 bg-[#3b82f6]/10 rounded-lg flex items-center justify-center">
                  <Receipt className="w-5 h-5 text-[#3b82f6]" />
                </div>
              </div>
            </div>
            <div className="bg-[#1a1a1a] rounded-xl p-5 border border-[#2a2a2a]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#888] text-sm font-medium">Approved</p>
                  <p className="text-2xl font-bold text-[#4ade80] mt-1">{report.approvedCount}</p>
                </div>
                <div className="w-10 h-10 bg-[#4ade80]/10 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-[#4ade80]" />
                </div>
              </div>
            </div>
            <div className="bg-[#1a1a1a] rounded-xl p-5 border border-[#2a2a2a]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#888] text-sm font-medium">Pending</p>
                  <p className="text-2xl font-bold text-[#fcd34d] mt-1">{report.pendingCount}</p>
                </div>
                <div className="w-10 h-10 bg-[#fcd34d]/10 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-[#fcd34d]" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a]">
            <div className="p-5 border-b border-[#2a2a2a]">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Top Vendors
              </h2>
              <p className="text-[#666] text-sm">By approved spending amount</p>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  <th className="text-left p-4 text-xs font-medium text-[#666] uppercase tracking-wider">Vendor</th>
                  <th className="text-left p-4 text-xs font-medium text-[#666] uppercase tracking-wider">Total Amount</th>
                  <th className="text-left p-4 text-xs font-medium text-[#666] uppercase tracking-wider">Documents</th>
                  <th className="text-left p-4 text-xs font-medium text-[#666] uppercase tracking-wider">Approved</th>
                </tr>
              </thead>
              <tbody>
                {report.byVendor.slice(0, 10).map((vendor) => (
                  <tr key={vendor.vendorName} className="border-b border-[#2a2a2a] last:border-0 hover:bg-[#0f0f0f]">
                    <td className="p-4 text-sm text-white">{vendor.vendorName}</td>
                    <td className="p-4 text-sm text-white">{formatCurrency(vendor.totalAmount)}</td>
                    <td className="p-4 text-sm text-[#ccc]">{vendor.documentCount}</td>
                    <td className="p-4 text-sm text-[#4ade80]">{vendor.approvedCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ==================== INSIGHTS SECTION ====================
function InsightsSection() {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        const response = await fetch('/api/insights');
        const data = await response.json();
        if (data.success) {
          setInsights(data.data.insights);
        }
      } catch (error) {
        console.error('Error fetching insights:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchInsights();
  }, []);

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'trend': return TrendingUp;
      case 'anomaly': return AlertTriangle;
      case 'warning': return AlertCircle;
      case 'recommendation': return Sparkles;
      default: return AlertCircle;
    }
  };

  const getInsightColors = (type: string, severity: string) => {
    const baseColors: Record<string, { bg: string; icon: string; border: string }> = {
      trend: { bg: 'bg-[#1e3a5f]', icon: 'text-[#60a5fa]', border: 'border-l-[#3b82f6]' },
      anomaly: { bg: 'bg-[#44403c]', icon: 'text-[#fcd34d]', border: 'border-l-[#fcd34d]' },
      warning: { bg: 'bg-[#7f1d1d]', icon: 'text-[#f87171]', border: 'border-l-[#ef4444]' },
      recommendation: { bg: 'bg-[#581c87]', icon: 'text-[#c084fc]', border: 'border-l-[#a855f7]' },
    };
    const colors = baseColors[type] || baseColors.recommendation;
    if (severity === 'high' && type !== 'warning') {
      colors.bg = 'bg-[#7f1d1d]';
      colors.icon = 'text-[#f87171]';
      colors.border = 'border-l-[#ef4444]';
    }
    return colors;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-[#3b82f6]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">AI Insights</h1>
        <p className="text-[#666] text-sm">Intelligent analysis (Based on approved documents)</p>
      </div>

      {insights.length === 0 ? (
        <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] py-12 text-center">
          <Sparkles className="w-10 h-10 text-[#333] mx-auto mb-3" />
          <p className="text-[#666]">No insights available yet</p>
          <p className="text-sm text-[#444]">Upload and approve documents to generate insights</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {insights.map((insight, index) => {
            const Icon = getInsightIcon(insight.type);
            const colors = getInsightColors(insight.type, insight.severity);
            return (
              <div key={index} className={`bg-[#1a1a1a] rounded-xl p-5 border border-[#2a2a2a] border-l-4 ${colors.border}`}>
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-[#0f0f0f] rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon className={`w-5 h-5 ${colors.icon}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{insight.title}</h3>
                    <p className="text-[#888] text-sm mt-1">{insight.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ==================== MAIN APP ====================
export default function DocuManageApp() {
  const { user, isAuthenticated, logout, checkSession } = useAuthStore();
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'upload': return <UploadSection />;
      case 'documents': return <DocumentsSection />;
      case 'approvals': return <ApprovalsSection />;
      case 'reports': return <ReportsSection />;
      case 'insights': return <InsightsSection />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} user={user} logout={logout} />
      <main className="ml-64 p-6">
        {renderContent()}
      </main>
    </div>
  );
}
