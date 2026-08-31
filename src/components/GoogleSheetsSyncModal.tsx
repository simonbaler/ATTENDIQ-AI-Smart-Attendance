import React, { useState } from 'react';
import {
  FileSpreadsheet,
  X,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Upload,
  Download,
  ShieldCheck,
  Sparkles,
  Database,
  ArrowRight,
  Eye,
} from 'lucide-react';
import { api } from '../services/api';
import { DepartmentInfo } from '../types';

interface GoogleSheetsSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  departments: DepartmentInfo[];
}

export interface SyncAuditReport {
  rowsFound: number;
  validStudents: number;
  missingPhotos: number;
  invalidPhotos: number;
  duplicateRollNumbers: number;
  embeddingReady: number;
  embeddingFailed: number;
  synchronizedCount: number;
  rejectedRows: Array<{ row: number; rollNumber?: string; reason: string }>;
}

export const GoogleSheetsSyncModal: React.FC<GoogleSheetsSyncModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  departments,
}) => {
  const [sheetUrl, setSheetUrl] = useState(
    'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit'
  );
  const [csvContent, setCsvContent] = useState('');
  const [activeTab, setActiveTab] = useState<'url' | 'csv'>('url');
  const [isProcessing, setIsProcessing] = useState(false);
  const [syncReport, setSyncReport] = useState<SyncAuditReport | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRunSync = async (dryRun: boolean = false) => {
    setIsProcessing(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // Execute authoritative sync via API
      const res = await api.syncGoogleSheetRoster({
        sheetUrl: activeTab === 'url' ? sheetUrl : undefined,
        csvText: activeTab === 'csv' ? csvContent : undefined,
        dryRun,
      });

      if (res.success && res.report) {
        setSyncReport(res.report);
        if (!dryRun) {
          setSuccessMsg(
            `Authoritative Google Sheets sync complete! Synchronized ${res.report.synchronizedCount} verified student records.`
          );
          onSuccess();
        }
      } else {
        setErrorMsg(res.message || 'Google Sheets synchronization failed.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error communicating with Google Sheets sync engine.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvContent((event.target?.result as string) || '');
      setActiveTab('csv');
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-5 text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-lg font-bold text-white">Google Sheets Master Synchronization</h3>
              <p className="text-xs text-slate-400">
                Authoritative student master source • Biometric integrity verification
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex space-x-2 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('url')}
            className={`flex-1 py-2 font-semibold rounded-md transition ${
              activeTab === 'url' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Google Sheets Live Connection
          </button>
          <button
            onClick={() => setActiveTab('csv')}
            className={`flex-1 py-2 font-semibold rounded-md transition ${
              activeTab === 'csv' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            CSV / Roster Direct Paste
          </button>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-950/70 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-lg bg-emerald-950/70 border border-emerald-800 text-emerald-300 text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Tab 1: Google Sheet URL */}
        {activeTab === 'url' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Google Sheets Public / Published URL
              </label>
              <input
                type="url"
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Columns supported: <code className="text-emerald-400">Roll Number</code>,{' '}
                <code className="text-emerald-400">Full Name</code>, <code className="text-emerald-400">Department</code>,{' '}
                <code className="text-emerald-400">Section</code>, <code className="text-emerald-400">Email</code>,{' '}
                <code className="text-emerald-400">Photo URL</code>.
              </p>
            </div>
          </div>
        )}

        {/* Tab 2: CSV / Text Paste */}
        {activeTab === 'csv' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-300">
                Paste CSV Rows or Upload .csv File
              </label>
              <label className="text-[11px] text-emerald-400 hover:text-emerald-300 cursor-pointer flex items-center space-x-1">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload CSV</span>
                <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
            <textarea
              rows={5}
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              placeholder="Roll Number,Full Name,Department,Section,Academic Year,Batch&#10;23A91A0501,Rahul Sharma,Computer Science & Engineering,A,2025-2026,2023-2027&#10;23A91A0502,Sneha Reddy,Computer Science & Engineering,A,2025-2026,2023-2027"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
        )}

        {/* Audit Report Dashboard (Section 6 Requirements) */}
        {syncReport && (
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Google Sheets Data Integrity Audit
                </h4>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Rows Evaluated: <strong className="text-white">{syncReport.rowsFound}</strong>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-slate-400 text-[10px]">Rows Found</div>
                <div className="text-base font-bold text-white mt-0.5">{syncReport.rowsFound}</div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-slate-400 text-[10px]">Valid Students</div>
                <div className="text-base font-bold text-emerald-400 mt-0.5">{syncReport.validStudents}</div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-slate-400 text-[10px]">Missing Photos</div>
                <div className="text-base font-bold text-amber-400 mt-0.5">{syncReport.missingPhotos}</div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-slate-400 text-[10px]">Invalid Photos</div>
                <div className="text-base font-bold text-rose-400 mt-0.5">{syncReport.invalidPhotos}</div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-slate-400 text-[10px]">Duplicate Rolls</div>
                <div className="text-base font-bold text-rose-400 mt-0.5">{syncReport.duplicateRollNumbers}</div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-slate-400 text-[10px]">Embedding Ready</div>
                <div className="text-base font-bold text-cyan-400 mt-0.5">{syncReport.embeddingReady}</div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-slate-400 text-[10px]">Embedding Failed</div>
                <div className="text-base font-bold text-slate-400 mt-0.5">{syncReport.embeddingFailed}</div>
              </div>
            </div>

            {syncReport.rejectedRows.length > 0 && (
              <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-900/60 text-xs space-y-1 text-rose-300">
                <div className="font-semibold text-rose-200">Rejection Audit Log:</div>
                <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                  {syncReport.rejectedRows.slice(0, 5).map((r, i) => (
                    <li key={i}>
                      Row {r.row} {r.rollNumber ? `(${r.rollNumber})` : ''}: {r.reason}
                    </li>
                  ))}
                  {syncReport.rejectedRows.length > 5 && (
                    <li>...and {syncReport.rejectedRows.length - 5} more issues.</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <button
            onClick={() => handleRunSync(true)}
            disabled={isProcessing}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition flex items-center space-x-2"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Validate Roster Integrity (Audit Only)</span>
          </button>

          <div className="flex space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition"
            >
              Close
            </button>
            <button
              onClick={() => handleRunSync(false)}
              disabled={isProcessing}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow flex items-center space-x-2 disabled:opacity-50"
            >
              {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
              <span>{isProcessing ? 'Synchronizing...' : 'Synchronize Authoritative Roster'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
