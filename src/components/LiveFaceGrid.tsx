import React, { useState } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  AlertTriangle,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Info,
  ChevronDown,
  ChevronUp,
  Camera,
  Smartphone,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import { RecognitionBox } from '../types';

interface LiveFaceGridProps {
  detectedFaces: RecognitionBox[];
  onManualOverride?: (studentId: string, rollNumber: string, name: string) => void;
  allowManualOverride?: boolean;
}

export const LiveFaceGrid: React.FC<LiveFaceGridProps> = ({
  detectedFaces,
  onManualOverride,
  allowManualOverride = true,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'VERIFIED' | 'VERIFYING' | 'UNKNOWN'>('ALL');
  const [expandedTrackId, setExpandedTrackId] = useState<string | null>(null);

  // Group and sort detected faces: Verified first, Verifying second, Unknown third
  const sortedFaces = [...detectedFaces].sort((a, b) => {
    const scoreA =
      a.liveness?.spoof_suspected ? 0 : a.status === 'RECOGNIZED' && a.isConfirmed ? 3 : a.status === 'RECOGNIZED' ? 2 : 1;
    const scoreB =
      b.liveness?.spoof_suspected ? 0 : b.status === 'RECOGNIZED' && b.isConfirmed ? 3 : b.status === 'RECOGNIZED' ? 2 : 1;
    return scoreB - scoreA;
  });

  const filteredFaces = sortedFaces.filter((face) => {
    if (filter === 'VERIFIED') return face.status === 'RECOGNIZED' && (face.isConfirmed || face.duplicateIgnored);
    if (filter === 'VERIFYING') return face.status === 'RECOGNIZED' && !face.isConfirmed && !face.duplicateIgnored;
    if (filter === 'UNKNOWN') return face.status !== 'RECOGNIZED' || face.liveness?.spoof_suspected;
    return true;
  });

  const verifiedCount = detectedFaces.filter(
    (f) => f.status === 'RECOGNIZED' && (f.isConfirmed || f.duplicateIgnored)
  ).length;
  const verifyingCount = detectedFaces.filter(
    (f) => f.status === 'RECOGNIZED' && !f.isConfirmed && !f.duplicateIgnored
  ).length;
  const unknownCount = detectedFaces.filter(
    (f) => f.status !== 'RECOGNIZED' || f.liveness?.spoof_suspected
  ).length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">
              Live Classroom Attendance Wall
            </h3>
            <p className="text-[11px] text-slate-400">
              Real-time multi-face biometric tracking & explainable verification
            </p>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1 rounded-lg font-medium transition ${
              filter === 'ALL'
                ? 'bg-slate-800 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All ({detectedFaces.length})
          </button>
          <button
            onClick={() => setFilter('VERIFIED')}
            className={`px-3 py-1 rounded-lg font-medium transition flex items-center space-x-1.5 ${
              filter === 'VERIFIED'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-emerald-400 hover:text-emerald-300'
            }`}
          >
            <UserCheck className="w-3 h-3" />
            <span>Verified ({verifiedCount})</span>
          </button>
          <button
            onClick={() => setFilter('VERIFYING')}
            className={`px-3 py-1 rounded-lg font-medium transition flex items-center space-x-1.5 ${
              filter === 'VERIFYING'
                ? 'bg-amber-600 text-white shadow'
                : 'text-amber-400 hover:text-amber-300'
            }`}
          >
            <Clock className="w-3 h-3" />
            <span>Verifying ({verifyingCount})</span>
          </button>
          <button
            onClick={() => setFilter('UNKNOWN')}
            className={`px-3 py-1 rounded-lg font-medium transition flex items-center space-x-1.5 ${
              filter === 'UNKNOWN'
                ? 'bg-rose-600 text-white shadow'
                : 'text-rose-400 hover:text-rose-300'
            }`}
          >
            <UserX className="w-3 h-3" />
            <span>Unknown ({unknownCount})</span>
          </button>
        </div>
      </div>

      {/* Grid of detected faces */}
      {filteredFaces.length === 0 ? (
        <div className="py-8 text-center bg-slate-950/60 rounded-xl border border-slate-800/80 p-6 space-y-2">
          <Eye className="w-8 h-8 mx-auto text-slate-600" />
          <p className="text-xs text-slate-400 font-medium">
            {detectedFaces.length === 0
              ? 'No faces currently detected in camera stream.'
              : 'No detected faces match the selected filter.'}
          </p>
          <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
            Point camera at classroom students. ATTENDIQ concurrently extracts 128-D descriptors and performs normalized vector matching against the Google Sheets master roster.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {filteredFaces.map((face, index) => {
            const isSpoof = face.liveness?.spoof_suspected;
            const isRecognized = face.status === 'RECOGNIZED' && face.student;
            const isConfirmed = isRecognized && (face.isConfirmed || face.duplicateIgnored);
            const isVerifying = isRecognized && !isConfirmed;
            const trackingId = face.tracking_id || `TRK-${1000 + index}`;
            const isExpanded = expandedTrackId === trackingId;

            const deptCode = isRecognized
              ? (face.student?.department || '')
                  .replace('Computer Science & Engineering', 'CSE')
                  .replace('Software Engineering', 'SE')
                  .replace('Electrical & Electronics Engineering', 'EEE')
                  .replace('Electronics & Communication Engineering', 'ECE')
                  .replace('Artificial Intelligence & Machine Learning', 'AIML')
                  .replace('Data Science', 'DS')
              : null;

            return (
              <div
                key={trackingId}
                className={`rounded-xl border p-3.5 transition-all shadow-sm flex flex-col justify-between space-y-3 ${
                  isSpoof
                    ? 'bg-rose-950/30 border-rose-800/60 text-rose-200'
                    : isConfirmed
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                    : isVerifying
                    ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                    : 'bg-slate-950/70 border-slate-800 text-slate-300'
                }`}
              >
                {/* Top Info Bar */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-slate-300 font-bold">
                      {trackingId}
                    </span>
                    {deptCode && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-emerald-300 font-bold">
                        {deptCode}
                      </span>
                    )}
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider flex items-center space-x-1 ${
                      isSpoof
                        ? 'bg-rose-600/30 text-rose-300 border border-rose-500/50'
                        : isConfirmed
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : isVerifying
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-rose-950/80 text-rose-400 border border-rose-800/80'
                    }`}
                  >
                    {isSpoof ? (
                      <>
                        <ShieldAlert className="w-3 h-3 text-rose-400" />
                        <span>SPOOF FLAGGED</span>
                      </>
                    ) : isConfirmed ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>{face.duplicateIgnored ? 'RECORDED' : 'VERIFIED'}</span>
                      </>
                    ) : isVerifying ? (
                      <>
                        <Clock className="w-3 h-3 text-amber-400" />
                        <span>CONFIRMING</span>
                      </>
                    ) : (
                      <>
                        <UserX className="w-3 h-3 text-rose-400" />
                        <span>NOT REGISTERED</span>
                      </>
                    )}
                  </span>
                </div>

                {/* Face Identity & Attributes */}
                <div className="space-y-1">
                  <div className="font-bold text-sm text-white truncate">
                    {isSpoof
                      ? 'Presentation Attack Blocked'
                      : isRecognized
                      ? face.student?.full_name
                      : 'Unknown Person'}
                  </div>

                  {isRecognized ? (
                    <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                      <span>{face.student?.roll_number}</span>
                      <span className="text-emerald-400 font-semibold">{face.confidence}% Match</span>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400">
                      {face.quality_valid ? 'No enrolled biometric match found' : face.quality_rejection || 'Low quality / Blur'}
                    </div>
                  )}
                </div>

                {/* Progress / Confirmation Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>Temporal Confirmation</span>
                    <span>
                      {isConfirmed
                        ? '3 / 3 (100%)'
                        : `${face.confirmationFrames || 1} / ${face.requiredFrames || 3} Frames`}
                    </span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isSpoof
                          ? 'bg-rose-500 w-full'
                          : isConfirmed
                          ? 'bg-emerald-500 w-full'
                          : isVerifying
                          ? 'bg-amber-400'
                          : 'bg-rose-500 w-1/4'
                      }`}
                      style={{
                        width: isConfirmed
                          ? '100%'
                          : isVerifying
                          ? `${((face.confirmationFrames || 1) / (face.requiredFrames || 3)) * 100}%`
                          : undefined,
                      }}
                    />
                  </div>
                </div>

                {/* Explainable AI Details Toggle */}
                <div className="pt-2 border-t border-slate-800/80">
                  <button
                    onClick={() => setExpandedTrackId(isExpanded ? null : trackingId)}
                    className="w-full text-left text-[11px] text-slate-400 hover:text-white flex items-center justify-between transition py-0.5 font-medium"
                  >
                    <span className="flex items-center space-x-1">
                      <Info className="w-3 h-3 text-blue-400" />
                      <span>Explainable AI Decision</span>
                    </span>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {isExpanded && (
                    <div className="mt-2 p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[10px] space-y-1.5 font-mono text-slate-300">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Euclidean Distance:</span>
                        <span className="text-cyan-300 font-bold">{face.distance?.toFixed(4) || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Recognition Threshold:</span>
                        <span className="text-slate-300">0.50 (Cosine: 75.0%)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Liveness Variance:</span>
                        <span className={face.liveness?.spoof_suspected ? 'text-rose-400' : 'text-emerald-400'}>
                          {face.liveness?.variance !== undefined ? face.liveness.variance.toFixed(4) : 'Normal Motion'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Embedding Vector:</span>
                        <span className="text-slate-400">128-D Normalized</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Decision Outcome:</span>
                        <span
                          className={`font-bold ${
                            isConfirmed
                              ? 'text-emerald-400'
                              : isVerifying
                              ? 'text-amber-400'
                              : isSpoof
                              ? 'text-rose-400'
                              : 'text-rose-300'
                          }`}
                        >
                          {isSpoof
                            ? 'REJECTED_SPOOF'
                            : isConfirmed
                            ? 'ACCEPTED_PRESENT'
                            : isVerifying
                            ? 'AWAITING_TEMPORAL'
                            : 'REJECTED_UNREGISTERED'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
