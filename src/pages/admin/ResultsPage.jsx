import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { gasApi } from '../../services/gasApi';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import {
  exportDetailedResultsToExcel,
  exportSingleParticipantResultToExcel
} from '../../utils/excelTemplate';
import {
  Award,
  AlertTriangle,
  Eye,
  Check,
  RotateCw,
  Download,
  Search,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Printer,
  FileText,
  Trash2,
  FileSpreadsheet
} from 'lucide-react';

export const ResultsPage = () => {
  const { adminSecretKey, isAdminLoggedIn } = useAuth();
  const navigate = useNavigate();

  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [questions, setQuestions] = useState([]);

  // Filter State
  const [selectedSession, setSelectedSession] = useState('');
  const [selectedKelas, setSelectedKelas] = useState('ALL');
  const [selectedPaket, setSelectedPaket] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Active Review Modal State
  const [activeSub, setActiveSub] = useState(null);
  const [essayScoreInput, setEssayScoreInput] = useState(0);
  const [savingGrade, setSavingGrade] = useState(false);
  const [reviewFilter, setReviewFilter] = useState('all'); // 'all', 'correct', 'wrong', 'essay'

  // State Pilihan & Hapus Nilai (Individu maupun Massal) dengan Unduh Excel & PDF Sebelum Hapus
  const [selectedSubIds, setSelectedSubIds] = useState([]);
  const [deleteModal, setDeleteModal] = useState({
    open: false,
    mode: 'single', // 'single' | 'bulk'
    targets: [],
    excelDownloaded: false,
    pdfDownloaded: false
  });
  const [autoDownloadExcelOnDelete, setAutoDownloadExcelOnDelete] = useState(true);
  const [deletingSubs, setDeletingSubs] = useState(false);

  useEffect(() => {
    if (!isAdminLoggedIn) {
      navigate('/admin/login');
      return;
    }
    loadData();
  }, [isAdminLoggedIn, navigate]);

  const loadData = async (forceRefresh = false) => {
    setLoading(true);
    try {
      const res = await gasApi.getAdminDashboard(adminSecretKey, forceRefresh);
      if (res.status === 'success') {
        setSubmissions(res.submissions || []);
        setParticipants(res.participants || []);
        setSessions(res.sessions || []);
        setQuestions(res.questions || []);
        if (res.sessions?.length > 0 && !selectedSession) {
          setSelectedSession(res.sessions[0].session_id);
        }
      }
    } catch (err) {
      console.error('Gagal memuat rekap nilai:', err);
    } finally {
      setLoading(false);
    }
  };

  // Helper evaluasi butir jawaban
  const evaluateQuestion = (q, userAns) => {
    if (q.type === 'essay') {
      return { isEssay: true, isCorrect: false, userText: String(userAns || '').trim() };
    }

    const key = String(q.key_answer || '').trim().toUpperCase();
    if (!userAns) {
      return { isCorrect: false, isBlank: true, userText: '(Kosong)', key };
    }

    if (q.type === 'single_choice') {
      const u = String(userAns).trim().toUpperCase();
      const isCorrect = u === key;
      return { isCorrect, isBlank: false, userText: u, key };
    }

    if (q.type === 'multiple_choice') {
      const u = Array.isArray(userAns)
        ? userAns.map(a => String(a).trim().toUpperCase()).sort().join(',')
        : String(userAns).split(',').map(a => a.trim().toUpperCase()).sort().join(',');
      const k = key.split(',').map(a => a.trim().toUpperCase()).sort().join(',');
      const isCorrect = u === k && u.length > 0;
      return { isCorrect, isBlank: false, userText: u, key: k };
    }

    return { isCorrect: false, isBlank: false, userText: String(userAns), key };
  };

  // Buka Modal Review Hasil Jawaban
  const handleOpenReviewModal = (sub) => {
    setActiveSub(sub);
    setEssayScoreInput(sub.essay_score || 0);
    setReviewFilter('all');
  };

  // Simpan Nilai Essay
  const handleSaveGrade = async () => {
    if (!activeSub) return;
    setSavingGrade(true);
    try {
      await gasApi.gradeEssay(adminSecretKey, activeSub.submission_id, essayScoreInput);
      alert('Nilai essay berhasil disimpan!');
      setActiveSub(prev => prev ? { ...prev, essay_score: essayScoreInput, total_score: Math.round(((prev.pg_score || 0) + essayScoreInput) / 2) } : null);
      loadData(true);
    } catch (err) {
      alert('Gagal menyimpan nilai essay: ' + err.message);
    } finally {
      setSavingGrade(false);
    }
  };

  // Unduh Rekap Lengkap Seluruh Peserta (Excel Format Template)
  const handleExportAll = () => {
    if (filteredSubmissions.length === 0) {
      alert('Tidak ada data submisi untuk diunduh.');
      return;
    }
    const sessionObj = sessions.find(s => s.session_id === selectedSession);
    const sessionName = (sessionObj?.title || 'Semua_Sesi').replace(/[^a-zA-Z0-9_]/g, '_');
    exportDetailedResultsToExcel(
      filteredSubmissions,
      questions,
      participants,
      sessions,
      `Rekap_Hasil_Ujian_${sessionName}_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  // Unduh Lembar Hasil Perorangan Peserta (.xlsx)
  const handleExportSingleExcel = () => {
    if (!activeSub) return;
    const part = participants.find(p => p.participant_id === activeSub.participant_id || p.username === activeSub.participant_id);
    const sess = sessions.find(s => s.session_id === activeSub.session_id);
    const cleanName = (part?.full_name || part?.username || 'Peserta').replace(/[^a-zA-Z0-9_]/g, '_');
    exportSingleParticipantResultToExcel(
      activeSub,
      questions,
      part,
      sess,
      `Hasil_Ujian_${cleanName}.xlsx`
    );
  };

  // Cetak / Unduh PDF Hasil Ujian Individual Per Peserta
  const handlePrintPdfIndividual = (subToPrint) => {
    const sub = subToPrint || activeSub;
    if (!sub) return;

    const part = participants.find(p => p.participant_id === sub.participant_id || p.username === sub.participant_id);
    const sess = sessions.find(s => s.session_id === sub.session_id);

    let parsedAnswers = {};
    try {
      parsedAnswers = typeof sub.answers_json === 'string' ? JSON.parse(sub.answers_json) : (sub.answers_json || {});
    } catch (e) {}

    let sessQuestions = questions.filter(q => q.session_id === sub.session_id);
    if (sessQuestions.length === 0 && Object.keys(parsedAnswers).length > 0) {
      sessQuestions = questions.filter(q => Object.keys(parsedAnswers).includes(q.question_id));
    }
    if (sessQuestions.length === 0) sessQuestions = questions;

    let correctCount = 0;
    let wrongCount = 0;
    let earnedPgWeight = 0;

    const questionRowsHtml = sessQuestions.map((q, idx) => {
      const qWeight = Number(q.weight) || 1;
      const userAns = parsedAnswers[q.question_id];
      const evalRes = evaluateQuestion(q, userAns);

      let statusBadge = '';
      if (evalRes.isEssay) {
        statusBadge = `<span style="background:#f3e8ff;color:#6b21a8;padding:3px 8px;border-radius:6px;font-weight:bold;font-size:11px;">Dinilai Essay (${sub.essay_score || 0}/100)</span>`;
      } else if (evalRes.isCorrect) {
        correctCount++;
        earnedPgWeight += qWeight;
        statusBadge = `<span style="background:#dcfce7;color:#166534;padding:3px 8px;border-radius:6px;font-weight:bold;font-size:11px;">&#10003; BETUL (BENAR)</span>`;
      } else if (evalRes.isBlank) {
        wrongCount++;
        statusBadge = `<span style="background:#f1f5f9;color:#64748b;padding:3px 8px;border-radius:6px;font-weight:bold;font-size:11px;">KOSONG</span>`;
      } else {
        wrongCount++;
        statusBadge = `<span style="background:#fee2e2;color:#991b1b;padding:3px 8px;border-radius:6px;font-weight:bold;font-size:11px;">&#10007; SALAH</span>`;
      }

      const userAnsFormatted = evalRes.isEssay
        ? `<em>"${evalRes.userText || '(Tidak dijawab)'}"</em>`
        : `<strong>${evalRes.userText || '(Kosong)'}</strong>`;

      const keyAnsFormatted = evalRes.isEssay
        ? `<small>Rubrik: ${q.key_answer || '-'}</small>`
        : `<strong>${evalRes.key || '-'}</strong>`;

      return `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
          <td style="padding: 6px 4px; text-align: center; font-weight: bold; vertical-align: top;">${idx + 1}</td>
          <td style="padding: 6px 8px; vertical-align: top;">
            <div style="font-weight: 600; color: #1e293b; margin-bottom: 3px;">${q.question_text || ''}</div>
            <div style="font-size: 10px; color: #64748b;">Tipe: ${q.type === 'single_choice' ? 'Pilihan Ganda' : q.type === 'multiple_choice' ? 'Pilihan Jamak' : 'Essay'} • Bobot: ${q.weight || 1} poin</div>
          </td>
          <td style="padding: 6px 8px; text-align: center; vertical-align: top;">${userAnsFormatted}</td>
          <td style="padding: 6px 8px; text-align: center; vertical-align: top; color: #047857;">${keyAnsFormatted}</td>
          <td style="padding: 6px 8px; text-align: center; vertical-align: top;">${statusBadge}</td>
        </tr>
      `;
    }).join('');

    const finalPgScore = earnedPgWeight > 0 ? earnedPgWeight : (Number(sub.pg_score) || 0);
    const finalEssayScore = Number(sub.essay_score) || 0;
    const finalTotalScore = finalPgScore + finalEssayScore;

    let cleanPaket = part?.paket || sess?.type || 'Pretest';
    if (/^\d{4}-\d{2}-\d{2}T/.test(cleanPaket) || cleanPaket === '-') {
      cleanPaket = sess?.type || 'Pretest';
    }
    const cleanKelas = (part?.kelas && part.kelas !== '-') ? part.kelas : (sess?.type ? 'PAI' : '-');

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Pop-up terblokir oleh browser. Harap izinkan pop-up untuk mencetak dokumen hasil ujian.');
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Hasil Ujian - ${part?.full_name || part?.username || 'Peserta'}</title>
        <style>
          @page { size: A4; margin: 12mm; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #0f172a; margin: 0; padding: 15px; line-height: 1.4; }
          .kop-table { width: 100%; border-collapse: collapse; border-bottom: 3px double #0d7a5f; padding-bottom: 8px; margin-bottom: 12px; }
          .kop-logo { width: 60px; height: 60px; object-fit: contain; }
          .kop-text { text-align: center; }
          .kop-text h2 { margin: 0; font-size: 14px; text-transform: uppercase; color: #0f172a; letter-spacing: 0.5px; }
          .kop-text h1 { margin: 2px 0; font-size: 16px; text-transform: uppercase; color: #0d7a5f; }
          .kop-text p { margin: 0; font-size: 11px; color: #475569; }
          .doc-title { text-align: center; font-size: 13px; font-weight: bold; text-decoration: underline; margin: 12px 0 8px; text-transform: uppercase; }
          .info-grid { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 11px; }
          .info-grid td { padding: 3px 6px; }
          .card-summary { display: flex; gap: 8px; margin-bottom: 12px; text-align: center; }
          .metric-box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 6px; background: #f8fafc; }
          .metric-box .label { font-size: 9px; text-transform: uppercase; font-weight: bold; color: #64748b; }
          .metric-box .val { font-size: 16px; font-weight: 900; color: #0f172a; margin-top: 1px; }
          .data-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          .data-table th { background: #f1f5f9; border-top: 1px solid #cbd5e1; border-bottom: 2px solid #94a3b8; padding: 6px 4px; font-size: 10px; text-transform: uppercase; font-weight: bold; }
          .footer-sign { width: 100%; margin-top: 25px; font-size: 11px; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <table class="kop-table">
          <tr>
            <td style="width: 70px; text-align: center;"><img src="${window.location.origin}/Logo_Kemenag.png" class="kop-logo" onerror="this.style.display='none'" /></td>
            <td class="kop-text">
              <h2>Kementerian Agama Republik Indonesia</h2>
              <h1>Fakultas Ilmu Tarbiyah dan Keguruan UIN Jakarta</h1>
              <p>Program Pelatihan & Asesmen Guru PAI Modern Berbasis CBT Online</p>
            </td>
            <td style="width: 70px; text-align: center;"><img src="${window.location.origin}/Logo_UIN.png" class="kop-logo" onerror="this.style.display='none'" /></td>
          </tr>
        </table>

        <div class="doc-title">Lembar Hasil Evaluasi Ujian Peserta CBT</div>

        <table class="info-grid">
          <tr>
            <td style="width: 18%; font-weight: bold;">Nama Peserta</td>
            <td style="width: 32%;">: <strong>${part?.full_name || part?.username || 'Peserta PAI'}</strong></td>
            <td style="width: 18%; font-weight: bold;">Mata Ujian</td>
            <td style="width: 32%;">: ${sess?.title || sub.session_id}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Nomor Peserta / NIP</td>
            <td>: ${part?.identifier || part?.username || '-'}</td>
            <td style="font-weight: bold;">Kelas & Paket</td>
            <td>: ${cleanKelas} (${cleanPaket})</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Asal Madrasah/Sekolah</td>
            <td>: ${part?.institution || '-'}</td>
            <td style="font-weight: bold;">Waktu Pengumpulan</td>
            <td>: ${sub.submitted_at ? new Date(sub.submitted_at).toLocaleString('id-ID') : '-'}</td>
          </tr>
        </table>

        <div style="display: table; width: 100%; margin-bottom: 12px;">
          <div style="display: table-row;">
            <div style="display: table-cell; width: 20%; padding: 3px;">
              <div class="metric-box" style="background:#ecfdf5; border-color:#a7f3d0;">
                <div class="label" style="color:#065f46;">Nilai Total</div>
                <div class="val" style="color:#047857;">${finalTotalScore}</div>
              </div>
            </div>
            <div style="display: table-cell; width: 20%; padding: 3px;">
              <div class="metric-box">
                <div class="label">Skor PG</div>
                <div class="val" style="color:#0f766e;">${finalPgScore}</div>
              </div>
            </div>
            <div style="display: table-cell; width: 20%; padding: 3px;">
              <div class="metric-box">
                <div class="label">Skor Essay</div>
                <div class="val" style="color:#7e22ce;">${finalEssayScore}</div>
              </div>
            </div>
            <div style="display: table-cell; width: 20%; padding: 3px;">
              <div class="metric-box" style="background:#f0fdf4;">
                <div class="label" style="color:#166534;">Jawaban Benar</div>
                <div class="val" style="color:#15803d;">${correctCount}</div>
              </div>
            </div>
            <div style="display: table-cell; width: 20%; padding: 3px;">
              <div class="metric-box" style="background:#fef2f2;">
                <div class="label" style="color:#991b1b;">Jawaban Salah</div>
                <div class="val" style="color:#b91c1c;">${wrongCount}</div>
              </div>
            </div>
          </div>
        </div>

        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 5%;">No</th>
              <th style="width: 50%; text-align: left;">Pertanyaan / Butir Soal</th>
              <th style="width: 15%;">Jawaban Peserta</th>
              <th style="width: 15%;">Kunci Jawaban</th>
              <th style="width: 15%;">Status Hasil</th>
            </tr>
          </thead>
          <tbody>
            ${questionRowsHtml}
          </tbody>
        </table>

        <table class="footer-sign">
          <tr>
            <td style="width: 60%;"></td>
            <td style="width: 40%; text-align: center;">
              <div>Jakarta, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
              <div style="margin-top: 3px; font-weight: bold;">Panitia Ujian & Pengawas CBT,</div>
              <div style="height: 50px;"></div>
              <div style="font-weight: bold; text-decoration: underline;">Panitia Pelatihan PAI</div>
              <div style="font-size: 10px; color: #64748b;">FITK UIN Syarif Hidayatullah Jakarta</div>
            </td>
          </tr>
        </table>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Cetak / Unduh PDF LENGKAP Semua Peserta yang Sudah Mengerjakan (atau subset target)
  const handlePrintPdfAll = (customSubmissions = null) => {
    const targetList = Array.isArray(customSubmissions) && customSubmissions.length > 0
      ? customSubmissions
      : filteredSubmissions;

    if (targetList.length === 0) {
      alert('Belum ada peserta yang mengumpulkan ujian untuk dicetak.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Pop-up terblokir oleh browser. Harap izinkan pop-up untuk mengunduh PDF lengkap.');
      return;
    }

    const sessionObj = sessions.find(s => s.session_id === selectedSession);
    const sessionTitle = sessionObj?.title || 'Semua Sesi Evaluasi Pelatihan Guru PAI';
    const avgScore = targetList.length > 0
      ? (targetList.reduce((acc, s) => acc + (Number(s.total_score) || 0), 0) / targetList.length).toFixed(1)
      : 0;
    const maxScore = targetList.length > 0
      ? Math.max(...targetList.map(s => Number(s.total_score) || 0))
      : 0;

    // Halaman 1: Tabel Rekapitulasi Nilai Semua Peserta
    const summaryRowsHtml = targetList.map((sub, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
        <td style="padding: 6px 4px; text-align: center; font-weight: bold;">${idx + 1}</td>
        <td style="padding: 6px 8px;">
          <div style="font-weight: bold; color: #0f172a;">${sub.participantName}</div>
          <div style="font-size: 10px; color: #64748b;">NIP/ID: ${sub.participantIdentifier}</div>
        </td>
        <td style="padding: 6px 6px; text-align: center;">${sub.participantKelas}</td>
        <td style="padding: 6px 6px; text-align: center;">${sub.participantPaket}</td>
        <td style="padding: 6px 6px; text-align: center; font-weight: bold; color: #15803d;">${sub.correctCount}</td>
        <td style="padding: 6px 6px; text-align: center; font-weight: bold; color: #b91c1c;">${sub.wrongCount}</td>
        <td style="padding: 6px 6px; text-align: center; font-weight: bold; color: #0f766e;">${sub.pg_score}</td>
        <td style="padding: 6px 6px; text-align: center; font-weight: bold; color: #7e22ce;">${sub.essay_score || 0}</td>
        <td style="padding: 6px 6px; text-align: center; font-weight: 900; color: #065f46; background: #ecfdf5;">${sub.total_score}</td>
        <td style="padding: 6px 6px; text-align: center;">${Number(sub.tab_switch_count) > 0 ? `${sub.tab_switch_count}x` : 'Tertib'}</td>
      </tr>
    `).join('');

    // Halaman Selanjutnya: Lembar Rincian Butir Soal Per Peserta
    const perParticipantPagesHtml = targetList.map((sub) => {
      const parsedAnswers = sub.parsedAnswers || {};
      let sessQuestions = questions.filter(q => q.session_id === sub.session_id);
      if (sessQuestions.length === 0 && Object.keys(parsedAnswers).length > 0) {
        sessQuestions = questions.filter(q => Object.keys(parsedAnswers).includes(q.question_id));
      }
      if (sessQuestions.length === 0) sessQuestions = questions;

      const qRows = sessQuestions.map((q, qIdx) => {
        const evalRes = evaluateQuestion(q, parsedAnswers[q.question_id]);
        let badge = '';
        if (evalRes.isEssay) {
          badge = `<span style="background:#f3e8ff;color:#6b21a8;padding:2px 6px;border-radius:4px;font-weight:bold;font-size:10px;">Essay (${sub.essay_score || 0})</span>`;
        } else if (evalRes.isCorrect) {
          badge = `<span style="background:#dcfce7;color:#166534;padding:2px 6px;border-radius:4px;font-weight:bold;font-size:10px;">&#10003; BETUL</span>`;
        } else if (evalRes.isBlank) {
          badge = `<span style="background:#f1f5f9;color:#64748b;padding:2px 6px;border-radius:4px;font-weight:bold;font-size:10px;">KOSONG</span>`;
        } else {
          badge = `<span style="background:#fee2e2;color:#991b1b;padding:2px 6px;border-radius:4px;font-weight:bold;font-size:10px;">&#10007; SALAH</span>`;
        }

        const uText = evalRes.isEssay ? `<em>${evalRes.userText || '(Kosong)'}</em>` : `<strong>${evalRes.userText || '(Kosong)'}</strong>`;
        const kText = evalRes.isEssay ? `<small>${q.key_answer || '-'}</small>` : `<strong>${evalRes.key || '-'}</strong>`;

        return `
          <tr style="border-bottom: 1px solid #e2e8f0; font-size: 10px; page-break-inside: avoid;">
            <td style="padding: 5px 4px; text-align: center; font-weight: bold;">${qIdx + 1}</td>
            <td style="padding: 5px 6px;">${q.question_text || ''}</td>
            <td style="padding: 5px 6px; text-align: center;">${uText}</td>
            <td style="padding: 5px 6px; text-align: center; color: #047857;">${kText}</td>
            <td style="padding: 5px 6px; text-align: center;">${badge}</td>
          </tr>
        `;
      }).join('');

      return `
        <div class="participant-section">
          <div style="border-bottom: 2px solid #0d7a5f; padding-bottom: 6px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 13px; font-weight: 800; color: #0f172a;">${sub.participantName}</div>
              <div style="font-size: 10px; color: #475569;">NIP/ID: ${sub.participantIdentifier} • Kelas: ${sub.participantKelas} • Paket: ${sub.participantPaket}</div>
            </div>
            <div style="text-align: right; font-size: 11px;">
              <div>Total Nilai: <strong style="color:#047857; font-size: 14px;">${sub.total_score}</strong> (PG: ${sub.pg_score} | Essay: ${sub.essay_score || 0})</div>
              <div style="font-size: 10px; color: #64748b;">Benar: ${sub.correctCount} • Salah: ${sub.wrongCount} • Pelanggaran: ${sub.tab_switch_count || 0}x</div>
            </div>
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 30px;">No</th>
                <th style="text-align: left;">Butir Pertanyaan</th>
                <th style="width: 75px;">Jawaban</th>
                <th style="width: 65px;">Kunci</th>
                <th style="width: 90px;">Status</th>
              </tr>
            </thead>
            <tbody>${qRows}</tbody>
          </table>
        </div>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Rekap PDF Lengkap - ${sessionTitle}</title>
        <style>
          @page { size: A4; margin: 12mm; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #0f172a; margin: 0; padding: 12px; line-height: 1.35; }
          .kop-table { width: 100%; border-collapse: collapse; border-bottom: 3px double #0d7a5f; padding-bottom: 8px; margin-bottom: 12px; }
          .kop-logo { width: 56px; height: 56px; object-fit: contain; }
          .kop-text { text-align: center; }
          .kop-text h2 { margin: 0; font-size: 13px; text-transform: uppercase; color: #0f172a; }
          .kop-text h1 { margin: 2px 0; font-size: 15px; text-transform: uppercase; color: #0d7a5f; }
          .kop-text p { margin: 0; font-size: 10px; color: #475569; }
          .doc-title { text-align: center; font-size: 13px; font-weight: bold; text-decoration: underline; margin: 10px 0 4px; text-transform: uppercase; }
          .sub-title { text-align: center; font-size: 11px; color: #475569; margin-bottom: 12px; }
          .stats-row { display: table; width: 100%; margin-bottom: 12px; }
          .stats-cell { display: table-cell; width: 25%; padding: 3px; }
          .metric-box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 6px; background: #f8fafc; text-align: center; }
          .metric-box .label { font-size: 9px; text-transform: uppercase; font-weight: bold; color: #64748b; }
          .metric-box .val { font-size: 15px; font-weight: 900; color: #0f172a; }
          .data-table { width: 100%; border-collapse: collapse; margin-top: 6px; }
          .data-table th { background: #f1f5f9; border-top: 1px solid #cbd5e1; border-bottom: 2px solid #94a3b8; padding: 6px 4px; font-size: 10px; text-transform: uppercase; font-weight: bold; }
          .participant-section { page-break-before: always; padding-top: 4px; }
        </style>
      </head>
      <body>
        <table class="kop-table">
          <tr>
            <td style="width: 65px; text-align: center;"><img src="${window.location.origin}/Logo_Kemenag.png" class="kop-logo" onerror="this.style.display='none'" /></td>
            <td class="kop-text">
              <h2>Kementerian Agama Republik Indonesia</h2>
              <h1>Fakultas Ilmu Tarbiyah dan Keguruan UIN Jakarta</h1>
              <p>Program Pelatihan & Asesmen Guru PAI Modern Berbasis CBT Online</p>
            </td>
            <td style="width: 65px; text-align: center;"><img src="${window.location.origin}/Logo_UIN.png" class="kop-logo" onerror="this.style.display='none'" /></td>
          </tr>
        </table>

        <div class="doc-title">Laporan Rekapitulasi Lengkap Hasil Ujian Peserta CBT</div>
        <div class="sub-title">${sessionTitle} • Dicetak pada ${new Date().toLocaleString('id-ID')}</div>

        <div class="stats-row">
          <div class="stats-cell"><div class="metric-box"><div class="label">Total Peserta</div><div class="val">${targetList.length}</div></div></div>
          <div class="stats-cell"><div class="metric-box" style="background:#ecfdf5;"><div class="label" style="color:#065f46;">Rata-rata Nilai</div><div class="val" style="color:#047857;">${avgScore}</div></div></div>
          <div class="stats-cell"><div class="metric-box"><div class="label">Nilai Tertinggi</div><div class="val" style="color:#0f766e;">${maxScore}</div></div></div>
          <div class="stats-cell"><div class="metric-box"><div class="label">Kelas Filter</div><div class="val" style="font-size:12px;">${selectedKelas === 'ALL' ? 'Semua Kelas' : selectedKelas}</div></div></div>
        </div>

        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 28px;">No</th>
              <th style="text-align: left;">Nama Peserta & NIP</th>
              <th style="width: 70px;">Kelas</th>
              <th style="width: 65px;">Paket</th>
              <th style="width: 45px;">Benar</th>
              <th style="width: 45px;">Salah</th>
              <th style="width: 55px;">Skor PG</th>
              <th style="width: 55px;">Essay</th>
              <th style="width: 60px;">Total</th>
              <th style="width: 65px;">Pelanggaran</th>
            </tr>
          </thead>
          <tbody>
            ${summaryRowsHtml}
          </tbody>
        </table>

        <table style="width: 100%; margin-top: 24px; font-size: 11px;">
          <tr>
            <td style="width: 60%;"></td>
            <td style="width: 40%; text-align: center;">
              <div>Jakarta, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
              <div style="margin-top: 3px; font-weight: bold;">Panitia Ujian & Pengawas CBT,</div>
              <div style="height: 45px;"></div>
              <div style="font-weight: bold; text-decoration: underline;">Panitia Pelatihan PAI</div>
              <div style="font-size: 10px; color: #64748b;">FITK UIN Syarif Hidayatullah Jakarta</div>
            </td>
          </tr>
        </table>

        ${perParticipantPagesHtml}

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 400);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Ekstrak Kelas & Paket Dinamis
  const dynamicClasses = Array.from(new Set(participants.map(p => p.kelas?.trim()).filter(Boolean)));
  const dynamicPackages = Array.from(new Set([
    ...questions.map(q => q.paket?.trim()),
    ...participants.map(p => p.paket?.trim())
  ].filter(Boolean)));

  // Gabungkan info peserta & sesi ke data submisi
  const enrichedSubmissions = submissions.map(sub => {
    const sess = sessions.find(s => s.session_id === sub.session_id);

    let parsedAnswers = {};
    try {
      parsedAnswers = typeof sub.answers_json === 'string'
        ? JSON.parse(sub.answers_json)
        : (sub.answers_json || {});
    } catch (e) {}

    let sessQuestions = questions.filter(q => q.session_id === sub.session_id && q.type !== 'essay');
    if (sessQuestions.length === 0 && Object.keys(parsedAnswers).length > 0) {
      sessQuestions = questions.filter(q => Object.keys(parsedAnswers).includes(q.question_id) && q.type !== 'essay');
    }
    if (sessQuestions.length === 0) {
      sessQuestions = questions.filter(q => q.type !== 'essay');
    }

    let correctCount = 0;
    let wrongCount = 0;
    let earnedPgWeight = 0;

    sessQuestions.forEach(q => {
      const qWeight = Number(q.weight) || 1;
      const evalRes = evaluateQuestion(q, parsedAnswers[q.question_id]);
      if (evalRes.isCorrect) {
        correctCount++;
        earnedPgWeight += qWeight;
      } else {
        wrongCount++;
      }
    });

    // Sesuai rumus ujian: Skor PG = Total Benar * Bobot Soal (misal: 5 benar * bobot 2 = 10)
    const finalPgScore = earnedPgWeight > 0 ? earnedPgWeight : (Number(sub.pg_score) || 0);
    const finalEssayScore = Number(sub.essay_score) || 0;
    const finalTotalScore = finalPgScore + finalEssayScore;

    // Cari profil peserta asli: prioritaskan pencocokan username/identifier agar tidak tertukar dengan baris duplikat
    const part = participants.find(p => 
      (p.username && (String(p.username).toLowerCase() === String(sub.participant_id).toLowerCase() || String(p.username).toLowerCase() === String(sub.username || '').toLowerCase())) ||
      (p.identifier && String(p.identifier).toLowerCase() === String(sub.participant_id).toLowerCase()) ||
      (p.participant_id && String(p.participant_id).toLowerCase() === String(sub.participant_id).toLowerCase())
    ) || participants.find(p => p.participant_id === sub.participant_id);

    // Sanitasi nama paket agar TIDAK memunculkan string ISO timestamp
    let cleanPaket = part?.paket || sess?.type || 'Pretest';
    if (/^\d{4}-\d{2}-\d{2}T/.test(cleanPaket) || cleanPaket === '-') {
      cleanPaket = sess?.type || 'Pretest';
    }

    const cleanKelas = (part?.kelas && part.kelas !== '-') ? part.kelas : (sess?.type ? 'PAI' : '-');

    return {
      ...sub,
      pg_score: finalPgScore,
      essay_score: finalEssayScore,
      total_score: finalTotalScore,
      participantName: part?.full_name || part?.username || 'Peserta PAI',
      participantUsername: part?.username || '-',
      participantIdentifier: part?.identifier || part?.username || '-',
      participantKelas: cleanKelas,
      participantInstitution: part?.institution || '-',
      participantPaket: cleanPaket,
      sessionTitle: sess?.title || '-',
      correctCount,
      wrongCount,
      parsedAnswers
    };
  });

  // Filter Submisi
  const filteredSubmissions = enrichedSubmissions.filter(s => {
    const matchSession = !selectedSession || s.session_id === selectedSession;
    const matchKelas = selectedKelas === 'ALL' || (s.participantKelas || '').toLowerCase() === selectedKelas.toLowerCase();
    const matchPaket = selectedPaket === 'ALL' || (s.participantPaket || '').toLowerCase() === selectedPaket.toLowerCase();
    const matchSearch =
      (s.participantName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.participantUsername || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.participantIdentifier || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.participantInstitution || '').toLowerCase().includes(searchTerm.toLowerCase());

    return matchSession && matchKelas && matchPaket && matchSearch;
  });

  // Toggle pilih baris untuk hapus massal
  const toggleSelectSub = (subId) => {
    setSelectedSubIds(prev =>
      prev.includes(subId) ? prev.filter(id => id !== subId) : [...prev, subId]
    );
  };

  const toggleSelectAllSubs = () => {
    const visibleIds = filteredSubmissions.map(s => s.submission_id);
    if (visibleIds.length > 0 && visibleIds.every(id => selectedSubIds.includes(id))) {
      setSelectedSubIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedSubIds(Array.from(new Set([...selectedSubIds, ...visibleIds])));
    }
  };

  // Buka Modal Hapus Nilai Individu (menampilkan tombol unduh Excel & PDF peserta tsb sebelum hapus)
  const handleOpenDeleteSingle = (sub) => {
    setDeleteModal({
      open: true,
      mode: 'single',
      targets: [sub],
      excelDownloaded: false,
      pdfDownloaded: false
    });
  };

  // Buka Modal Hapus Nilai Massal (menggunakan baris tercentang, atau semua baris tampil jika belum ada yg dicentang)
  const handleOpenDeleteBulk = () => {
    const selectedTargets = filteredSubmissions.filter(s => selectedSubIds.includes(s.submission_id));
    const targets = selectedTargets.length > 0 ? selectedTargets : filteredSubmissions;
    if (targets.length === 0) {
      alert('Tidak ada data nilai untuk dihapus.');
      return;
    }
    setDeleteModal({
      open: true,
      mode: 'bulk',
      targets,
      excelDownloaded: false,
      pdfDownloaded: false
    });
  };

  // Unduh Excel khusus target yang akan dihapus
  const handleDownloadTargetExcel = (targets = deleteModal.targets) => {
    if (!targets || targets.length === 0) return;
    const nowTag = new Date().toISOString().slice(0, 10);
    if (targets.length === 1) {
      const sub = targets[0];
      const part = participants.find(p => p.participant_id === sub.participant_id || p.username === sub.participant_id);
      const sess = sessions.find(s => s.session_id === sub.session_id);
      const cleanName = (part?.full_name || sub.participantName || 'Peserta').replace(/[^a-zA-Z0-9_]/g, '_');
      exportSingleParticipantResultToExcel(
        sub,
        questions,
        part,
        sess,
        `Backup_Hapus_Nilai_${cleanName}_${nowTag}.xlsx`
      );
    } else {
      exportDetailedResultsToExcel(
        targets,
        questions,
        participants,
        sessions,
        `Backup_Hapus_Nilai_Massal_${targets.length}_Peserta_${nowTag}.xlsx`
      );
    }
    setDeleteModal(prev => ({ ...prev, excelDownloaded: true }));
  };

  // Unduh PDF khusus target yang akan dihapus
  const handleDownloadTargetPdf = () => {
    const targets = deleteModal.targets || [];
    if (targets.length === 0) return;
    if (targets.length === 1) {
      handlePrintPdfIndividual(targets[0]);
    } else {
      handlePrintPdfAll(targets);
    }
    setDeleteModal(prev => ({ ...prev, pdfDownloaded: true }));
  };

  // Eksekusi Hapus Nilai ke Google Sheets (auto-backup Excel jika belum diunduh & dicentang)
  const handleConfirmDeleteSubmissions = async () => {
    const targets = deleteModal.targets || [];
    if (targets.length === 0) return;

    setDeletingSubs(true);
    try {
      if (autoDownloadExcelOnDelete && !deleteModal.excelDownloaded) {
        handleDownloadTargetExcel(targets);
      }
      const ids = targets.map(t => t.submission_id);
      const res = await gasApi.deleteSubmissions(adminSecretKey, ids);
      alert(res.message || `Berhasil menghapus ${ids.length} data nilai peserta.`);
      setDeleteModal({
        open: false,
        mode: 'single',
        targets: [],
        excelDownloaded: false,
        pdfDownloaded: false
      });
      setSelectedSubIds(prev => prev.filter(id => !ids.includes(id)));
      if (activeSub && ids.includes(activeSub.submission_id)) {
        setActiveSub(null);
      }
      await loadData(true);
    } catch (err) {
      alert('Gagal menghapus data nilai: ' + err.message);
    } finally {
      setDeletingSubs(false);
    }
  };

  // Hitung detail pertanyaan untuk activeSub saat modal review terbuka (dengan robust fallback)
  const activeQuestions = activeSub
    ? (questions.filter(q => q.session_id === activeSub.session_id).length > 0
        ? questions.filter(q => q.session_id === activeSub.session_id)
        : (activeSub.parsedAnswers && Object.keys(activeSub.parsedAnswers).length > 0
            ? questions.filter(q => Object.keys(activeSub.parsedAnswers).includes(q.question_id))
            : questions))
    : [];

  const analyzedActiveQuestions = activeQuestions.map((q, idx) => {
    const userAns = activeSub?.parsedAnswers ? activeSub.parsedAnswers[q.question_id] : undefined;
    const evalRes = evaluateQuestion(q, userAns);

    let parsedOptions = [];
    try {
      parsedOptions = typeof q.options === 'string' ? JSON.parse(q.options) : (q.options || []);
    } catch (e) {}

    return {
      ...q,
      originalIndex: idx + 1,
      userAns,
      evalRes,
      parsedOptions
    };
  });

  // Filter pertanyaan di dalam modal review
  const filteredActiveQuestions = analyzedActiveQuestions.filter(item => {
    if (reviewFilter === 'correct') return item.evalRes.isCorrect;
    if (reviewFilter === 'wrong') return !item.evalRes.isCorrect && !item.evalRes.isEssay;
    if (reviewFilter === 'essay') return item.evalRes.isEssay;
    return true;
  });

  if (loading) {
    return (
      <AdminLayout title="Rekapitulasi Nilai & Penilaian Essay">
        <LoadingScreen
          message="Memuat Rekapitulasi Nilai & Jawaban Peserta..."
          submessage="Sedang mengevaluasi lembar jawaban dan skor butir soal..."
        />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Rekapitulasi Nilai & Penilaian Essay">
      <div className="space-y-6">
        {/* Bar Filter & Aksi Ekspor */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-kemenag-100 shadow-sm">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Input Pencarian */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari Nama, NIP, Username..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 rounded-2xl border border-slate-200 text-xs w-48 bg-slate-50 focus:bg-white focus:outline-none focus:border-kemenag-600 font-medium"
              />
            </div>

            {/* Filter Sesi Ujian */}
            <select
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              className="px-3 py-2 rounded-2xl border border-slate-200 text-xs bg-slate-50 font-bold text-slate-700"
            >
              <option value="">Semua Sesi Ujian</option>
              {sessions.map(s => (
                <option key={s.session_id} value={s.session_id}>
                  {s.title}
                </option>
              ))}
            </select>

            {/* Filter Kelas Dinamis */}
            <select
              value={selectedKelas}
              onChange={(e) => setSelectedKelas(e.target.value)}
              className="px-3 py-2 rounded-2xl border border-slate-200 text-xs bg-slate-50 font-bold text-slate-700"
            >
              <option value="ALL">Semua Kelas ({dynamicClasses.length})</option>
              {dynamicClasses.map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>

            {/* Filter Paket Dinamis */}
            <select
              value={selectedPaket}
              onChange={(e) => setSelectedPaket(e.target.value)}
              className="px-3 py-2 rounded-2xl border border-slate-200 text-xs bg-slate-50 font-bold text-slate-700"
            >
              <option value="ALL">Semua Paket ({dynamicPackages.length})</option>
              {dynamicPackages.map(pkt => (
                <option key={pkt} value={pkt}>{pkt}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs text-kemenag-800 font-bold bg-kemenag-50 px-3 py-2 rounded-2xl border border-kemenag-200">
              Total Submisi: {filteredSubmissions.length} peserta
            </span>

            {/* Tombol Segarkan */}
            <Button
              variant="outline"
              size="sm"
              icon={RotateCw}
              onClick={() => loadData(true)}
              title="Segarkan data hasil ujian dari Google Sheets"
              className="border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              Segarkan
            </Button>

            {/* Tombol Unduh PDF Lengkap Semua Peserta */}
            <Button
              variant="primary"
              size="sm"
              icon={Printer}
              onClick={handlePrintPdfAll}
              title="Cetak atau simpan PDF rekap & rincian lembar jawaban seluruh peserta yang sudah mengerjakan"
              className="font-bold"
            >
              Unduh PDF Lengkap (.pdf)
            </Button>

            {/* Tombol Ekspor Rekap Lengkap & Analisis Jawaban (.xlsx) Sesuai Template */}
            <Button
              variant="secondary"
              size="sm"
              icon={Download}
              onClick={handleExportAll}
              title="Unduh seluruh rekap nilai beserta urutan soal template ke file Excel (.xlsx)"
              className="border-emerald-300 text-emerald-800 hover:bg-emerald-50 font-bold"
            >
              Unduh Excel Massal (.xlsx)
            </Button>

            {/* Tombol Hapus Nilai Massal / Terpilih */}
            {filteredSubmissions.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                icon={Trash2}
                onClick={handleOpenDeleteBulk}
                title="Hapus nilai peserta secara massal (tersedia unduh Excel & PDF sebelum dihapus)"
                className="border-rose-300 text-rose-700 hover:bg-rose-50 font-bold"
              >
                {selectedSubIds.filter(id => filteredSubmissions.some(s => s.submission_id === id)).length > 0
                  ? `Hapus Terpilih (${selectedSubIds.filter(id => filteredSubmissions.some(s => s.submission_id === id)).length})`
                  : `Hapus Nilai Massal (${filteredSubmissions.length})`}
              </Button>
            )}
          </div>
        </div>

        {/* Tabel Rekap Nilai Peserta */}
        <Card className="overflow-hidden bg-white rounded-3xl border border-kemenag-100 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-600 font-bold">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        filteredSubmissions.length > 0 &&
                        filteredSubmissions.every(s => selectedSubIds.includes(s.submission_id))
                      }
                      onChange={toggleSelectAllSubs}
                      className="rounded text-kemenag-600 focus:ring-kemenag-500"
                      title="Pilih semua nilai yang tampil"
                    />
                  </th>
                  <th className="py-3 px-3 w-10 text-center">No</th>
                  <th className="py-3 px-4 min-w-[180px]">Peserta & NIP</th>
                  <th className="py-3 px-4 min-w-[120px]">Kelas</th>
                  <th className="py-3 px-4 min-w-[110px]">Paket</th>
                  <th className="py-3 px-4 text-center min-w-[90px]">Skor PG</th>
                  <th className="py-3 px-4 text-center min-w-[90px]">Skor Essay</th>
                  <th className="py-3 px-4 text-center min-w-[100px]">Total Nilai</th>
                  <th className="py-3 px-4 text-center min-w-[130px]">Analisis PG (B/S)</th>
                  <th className="py-3 px-4 text-center min-w-[100px]">Pelanggaran</th>
                  <th className="py-3 px-4 min-w-[110px]">Waktu Selesai</th>
                  <th className="py-3 px-4 text-center min-w-[170px]">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredSubmissions.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="p-10 text-center text-slate-400">
                      Belum ada lembar jawaban yang dikumpulkan untuk kriteria yang dipilih.
                    </td>
                  </tr>
                ) : (
                  filteredSubmissions.map((sub, idx) => {
                    const isChecked = selectedSubIds.includes(sub.submission_id);
                    return (
                    <tr
                      key={sub.submission_id}
                      className={`transition ${isChecked ? 'bg-rose-50/50' : 'hover:bg-kemenag-50/40'}`}
                    >
                      <td className="py-3.5 px-3 text-center align-top">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectSub(sub.submission_id)}
                          className="rounded text-rose-600 focus:ring-rose-500 mt-0.5"
                        />
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold text-slate-500 align-top">
                        {idx + 1}
                      </td>

                      {/* Peserta */}
                      <td className="py-3.5 px-4 align-top">
                        <span className="font-bold text-slate-800 block text-xs break-words max-w-[200px] leading-snug">
                          {sub.participantName}
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium block mt-0.5">
                          NIP: {sub.participantIdentifier}
                        </span>
                      </td>

                      {/* Kelas */}
                      <td className="py-3.5 px-4 align-top">
                        <span className="inline-block px-2.5 py-1 rounded-xl text-[11px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200 leading-snug break-words max-w-[140px]">
                          {sub.participantKelas}
                        </span>
                      </td>

                      {/* Paket */}
                      <td className="py-3.5 px-4 align-top">
                        <span className="inline-block px-2.5 py-1 rounded-xl text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200 leading-snug break-words max-w-[120px]">
                          {sub.participantPaket}
                        </span>
                      </td>

                      {/* Skor PG */}
                      <td className="py-3.5 px-4 text-center font-bold text-kemenag-700 text-sm align-top">
                        {sub.pg_score}
                      </td>

                      {/* Skor Essay */}
                      <td className="py-3.5 px-4 text-center font-bold text-purple-700 text-sm align-top">
                        {sub.essay_score || 0}
                      </td>

                      {/* Total Nilai */}
                      <td className="py-3.5 px-4 text-center align-top">
                        <span className="font-extrabold text-sm px-3 py-1 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300 inline-block shadow-sm">
                          {sub.total_score}
                        </span>
                      </td>

                      {/* Analisis PG (Benar / Salah) */}
                      <td className="py-3.5 px-4 text-center align-top">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                          <span className="font-bold text-emerald-700 flex items-center gap-0.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            {sub.correctCount}
                          </span>
                          <span className="text-slate-300">/</span>
                          <span className="font-bold text-rose-700 flex items-center gap-0.5">
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            {sub.wrongCount}
                          </span>
                        </div>
                      </td>

                      {/* Pelanggaran */}
                      <td className="py-3.5 px-4 text-center align-top">
                        {Number(sub.tab_switch_count) > 0 ? (
                          <span className="inline-flex items-center gap-1 font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-xl text-xs">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                            {sub.tab_switch_count}x
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-semibold text-xs">0 (Tertib)</span>
                        )}
                      </td>

                      {/* Waktu Submit */}
                      <td className="py-3.5 px-4 text-slate-500 font-medium text-xs align-top">
                        {sub.submitted_at ? new Date(sub.submitted_at).toLocaleTimeString('id-ID') : '-'}
                      </td>

                      {/* Aksi: Detail, Cetak PDF, & Hapus Nilai Individu */}
                      <td className="py-3.5 px-4 text-center align-top">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={Eye}
                            onClick={() => handleOpenReviewModal(sub)}
                            className="border-emerald-300 text-emerald-800 hover:bg-emerald-50 text-xs py-1 px-2"
                            title="Lihat rincian lembar jawaban"
                          >
                            Detail
                          </Button>
                          <button
                            onClick={() => handlePrintPdfIndividual(sub)}
                            className="p-1.5 rounded-xl text-slate-700 bg-slate-50 hover:bg-slate-100 transition border border-slate-200"
                            title="Cetak / Simpan PDF Lembar Jawaban Peserta Ini"
                          >
                            <Printer className="w-4 h-4 text-slate-600" />
                          </button>
                          <button
                            onClick={() => handleOpenDeleteSingle(sub)}
                            className="p-1.5 rounded-xl text-rose-600 bg-rose-50 hover:bg-rose-100 transition border border-rose-200"
                            title="Hapus Nilai Peserta Ini (Unduh Excel & PDF tersedia sebelum dihapus)"
                          >
                            <Trash2 className="w-4 h-4 text-rose-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Modal Visual Hasil Jawaban dengan Nilai & Betul/Salah */}
      {activeSub && (
        <Modal
          isOpen={Boolean(activeSub)}
          onClose={() => setActiveSub(null)}
          title={`Detail Hasil Ujian: ${activeSub.participantName}`}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-5">
            {/* Kartu Ringkasan Nilai & Metrik Peserta */}
            <div className="p-5 rounded-3xl bg-slate-50 border border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div>
                  <h4 className="font-extrabold text-slate-800 text-base">{activeSub.participantName}</h4>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    NIP: {activeSub.participantIdentifier} • Kelas: <strong className="text-emerald-800">{activeSub.participantKelas}</strong> • Paket: <strong className="text-amber-900">{activeSub.participantPaket}</strong> • {activeSub.participantInstitution}
                  </p>
                </div>
                {/* Tombol Cetak PDF & Unduh Excel Individu */}
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Printer}
                    onClick={() => handlePrintPdfIndividual(activeSub)}
                    className="text-xs font-bold"
                  >
                    Cetak / Simpan PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={Download}
                    onClick={handleExportSingleExcel}
                    className="border-emerald-400 text-emerald-800 hover:bg-emerald-50 text-xs font-bold"
                  >
                    Unduh Excel (.xlsx)
                  </Button>
                </div>
              </div>

              {/* Grid 5 Metrik Nilai & Betul/Salah */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Nilai Total</span>
                  <span className="text-2xl font-black text-kemenag-800">{activeSub.total_score}</span>
                </div>
                <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Skor PG</span>
                  <span className="text-2xl font-black text-emerald-700">{activeSub.pg_score}</span>
                </div>
                <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Skor Essay</span>
                  <span className="text-2xl font-black text-purple-700">{activeSub.essay_score || 0}</span>
                </div>
                <div className="p-3 bg-emerald-50/70 rounded-2xl border border-emerald-200 shadow-sm">
                  <span className="text-[10px] font-bold uppercase text-emerald-700 block mb-0.5">Jawaban Benar</span>
                  <span className="text-2xl font-black text-emerald-800 flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    {activeSub.correctCount}
                  </span>
                </div>
                <div className="p-3 bg-rose-50/70 rounded-2xl border border-rose-200 shadow-sm col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-bold uppercase text-rose-700 block mb-0.5">Jawaban Salah</span>
                  <span className="text-2xl font-black text-rose-800 flex items-center justify-center gap-1">
                    <XCircle className="w-5 h-5 text-rose-600" />
                    {activeSub.wrongCount}
                  </span>
                </div>
              </div>
            </div>

            {/* Filter Pill Tab di dalam Modal */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2">
              <button
                onClick={() => setReviewFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  reviewFilter === 'all'
                    ? 'bg-kemenag-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Semua Soal ({analyzedActiveQuestions.length})
              </button>
              <button
                onClick={() => setReviewFilter('correct')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                  reviewFilter === 'correct'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Benar Saja ({analyzedActiveQuestions.filter(q => q.evalRes.isCorrect).length})
              </button>
              <button
                onClick={() => setReviewFilter('wrong')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                  reviewFilter === 'wrong'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
                }`}
              >
                <XCircle className="w-3.5 h-3.5" />
                Salah Saja ({analyzedActiveQuestions.filter(q => !q.evalRes.isCorrect && !q.evalRes.isEssay).length})
              </button>
              {analyzedActiveQuestions.some(q => q.evalRes.isEssay) && (
                <button
                  onClick={() => setReviewFilter('essay')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    reviewFilter === 'essay'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-purple-50 text-purple-800 border border-purple-200 hover:bg-purple-100'
                  }`}
                >
                  Soal Essay ({analyzedActiveQuestions.filter(q => q.evalRes.isEssay).length})
                </button>
              )}
            </div>

            {/* Daftar Visual Soal & Status Betul/Salah */}
            <div className="space-y-4 max-h-[480px] overflow-y-auto pr-2">
              {filteredActiveQuestions.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Tidak ada butir soal yang cocok dengan filter yang dipilih.
                </div>
              ) : (
                filteredActiveQuestions.map((q) => {
                  const evalRes = q.evalRes;

                  return (
                    <div
                      key={q.question_id}
                      className={`p-4 rounded-3xl border transition ${
                        evalRes.isEssay
                          ? 'bg-purple-50/30 border-purple-200'
                          : evalRes.isCorrect
                          ? 'bg-emerald-50/30 border-emerald-200'
                          : 'bg-rose-50/30 border-rose-200'
                      }`}
                    >
                      {/* Baris Atas: Nomor Soal, Bobot, & Status Badge */}
                      <div className="flex items-center justify-between gap-3 mb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-xs px-2.5 py-1 rounded-xl bg-slate-800 text-white">
                            Soal #{q.originalIndex}
                          </span>
                          <span className="text-[11px] font-bold text-slate-500 uppercase">
                            {q.type === 'single_choice' ? 'Pilihan Ganda' : q.type === 'multiple_choice' ? 'Pilihan Jamak' : 'Essay'} • {q.weight || 1} Poin
                          </span>
                        </div>

                        {/* Status Betul / Salah Badge */}
                        {evalRes.isEssay ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold bg-purple-100 text-purple-900 border border-purple-300">
                            Dinilai Essay ({activeSub.essay_score || 0}/100)
                          </span>
                        ) : evalRes.isCorrect ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-sm">
                            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                            BETUL (BENAR)
                          </span>
                        ) : evalRes.isBlank ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-slate-200 text-slate-700 border border-slate-300">
                            <HelpCircle className="w-4 h-4 text-slate-500" />
                            KOSONG / TIDAK DIJAWAB
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-rose-100 text-rose-900 border border-rose-300 shadow-sm">
                            <XCircle className="w-4 h-4 text-rose-700" />
                            SALAH
                          </span>
                        )}
                      </div>

                      {/* Teks Soal */}
                      <p className="font-semibold text-slate-800 text-xs leading-relaxed mb-3">
                        {q.question_text}
                      </p>

                      {/* Gambar Soal (jika ada) */}
                      {q.image_url && (
                        <div className="mb-3">
                          <img
                            src={q.image_url}
                            alt="Ilustrasi Soal"
                            className="max-h-48 rounded-2xl border border-slate-200 object-contain bg-white"
                          />
                        </div>
                      )}

                      {/* Tampilan Visual Opsi Pilihan Ganda */}
                      {q.type !== 'essay' && q.parsedOptions && q.parsedOptions.length > 0 && (
                        <div className="space-y-1.5 mb-3">
                          {q.parsedOptions.map((opt) => {
                            const optId = String(opt.id || '').toUpperCase();
                            const isChosen = q.type === 'single_choice'
                              ? String(evalRes.userText || '').toUpperCase() === optId
                              : String(evalRes.userText || '').toUpperCase().split(',').includes(optId);

                            const isKey = q.type === 'single_choice'
                              ? String(evalRes.key || '').toUpperCase() === optId
                              : String(evalRes.key || '').toUpperCase().split(',').includes(optId);

                            let optStyle = 'bg-white border-slate-200 text-slate-700';
                            if (isChosen && isKey) {
                              optStyle = 'bg-emerald-100 border-emerald-400 text-emerald-950 font-bold';
                            } else if (isChosen && !isKey) {
                              optStyle = 'bg-rose-100 border-rose-400 text-rose-950 font-bold';
                            } else if (isKey) {
                              optStyle = 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold';
                            }

                            return (
                              <div
                                key={opt.id}
                                className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${optStyle}`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                                    isChosen ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700'
                                  }`}>
                                    {opt.id}
                                  </span>
                                  <span>{opt.text}</span>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  {isChosen && (
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                      isKey ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'
                                    }`}>
                                      Pilihan Peserta
                                    </span>
                                  )}
                                  {isKey && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-600 text-white flex items-center gap-1">
                                      <Check className="w-3 h-3" /> Kunci
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Ringkasan Perbandingan Jawaban Peserta vs Kunci */}
                      {q.type !== 'essay' && (
                        <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-xs flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500 font-medium">Jawaban Peserta:</span>
                            <span className={`font-mono font-bold px-2 py-0.5 rounded-lg ${
                              evalRes.isCorrect
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                : evalRes.isBlank
                                ? 'bg-slate-100 text-slate-500 border border-slate-300'
                                : 'bg-rose-100 text-rose-900 border border-rose-300'
                            }`}>
                              {evalRes.userText || '(Kosong)'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500 font-medium">Kunci Jawaban:</span>
                            <span className="font-mono font-bold px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300">
                              {evalRes.key}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Detail Soal Essay: Jawaban Peserta, Rubrik, & Penilaian */}
                      {evalRes.isEssay && (
                        <div className="space-y-3 pt-2">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-500 mb-1">
                              Jawaban Essay Peserta:
                            </label>
                            <div className="p-3 bg-white rounded-2xl border border-purple-200 text-slate-800 text-xs whitespace-pre-line font-medium shadow-sm">
                              {evalRes.userText ? `"${evalRes.userText}"` : <span className="text-slate-400 italic">(Peserta tidak mengisi jawaban)</span>}
                            </div>
                          </div>

                          <div className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-200 text-xs text-purple-900">
                            <strong className="block text-[11px] uppercase tracking-wider mb-0.5">Rubrik Penilaian:</strong>
                            <p className="text-slate-700">{q.key_answer || 'Tidak ada rubrik khusus.'}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Input Nilai Essay & Footer Modal */}
            <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Beri / Perbarui Nilai Essay (0-100):
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={essayScoreInput}
                    onChange={(e) => setEssayScoreInput(Number(e.target.value))}
                    className="w-32 px-3 py-1.5 rounded-xl border border-slate-300 text-sm font-bold text-purple-800 focus:outline-none focus:border-purple-600"
                  />
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveGrade}
                  disabled={savingGrade}
                  icon={Check}
                  className="mt-4"
                >
                  {savingGrade ? 'Menyimpan...' : 'Simpan Nilai'}
                </Button>
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  className="border-rose-300 text-rose-700 hover:bg-rose-50"
                  icon={Trash2}
                  onClick={() => handleOpenDeleteSingle(activeSub)}
                >
                  Hapus Nilai
                </Button>
                <Button
                  variant="secondary"
                  className="w-full sm:w-auto"
                  onClick={() => setActiveSub(null)}
                >
                  Tutup
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Konfirmasi Hapus Nilai (Individu / Massal) + Unduh Excel & PDF Terkait Sebelum Hapus */}
      <Modal
        isOpen={deleteModal.open}
        onClose={() => !deletingSubs && setDeleteModal(prev => ({ ...prev, open: false }))}
        title={
          deleteModal.mode === 'single'
            ? `Hapus Nilai: ${deleteModal.targets[0]?.participantName || 'Peserta'}`
            : `Hapus Nilai Massal (${deleteModal.targets.length} Peserta)`
        }
        maxWidth="max-w-xl"
      >
        <div className="space-y-4 text-xs">
          {/* Ringkasan Data yang Akan Dihapus */}
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1 min-w-0">
              <h5 className="font-extrabold text-rose-950 text-sm">
                Konfirmasi Penghapusan Data Nilai ({deleteModal.targets.length} Submisi)
              </h5>
              <p className="text-rose-800 leading-relaxed">
                {deleteModal.mode === 'single'
                  ? `Nilai dan lembar jawaban atas nama "${deleteModal.targets[0]?.participantName}" (Skor Total: ${deleteModal.targets[0]?.total_score || 0}) akan dihapus permanen dari database.`
                  : `Sebanyak ${deleteModal.targets.length} data nilai & lembar jawaban peserta terpilih akan dihapus permanen dari database.`}
              </p>
              {deleteModal.targets.length > 1 && (
                <div className="flex flex-wrap gap-1.5 pt-1.5 max-h-24 overflow-y-auto">
                  {deleteModal.targets.slice(0, 12).map((t) => (
                    <span
                      key={t.submission_id}
                      className="px-2 py-0.5 rounded-lg bg-white border border-rose-200 text-rose-900 font-semibold text-[11px]"
                    >
                      {t.participantName} ({t.total_score})
                    </span>
                  ))}
                  {deleteModal.targets.length > 12 && (
                    <span className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-900 font-bold text-[11px]">
                      +{deleteModal.targets.length - 12} peserta lainnya
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Bagian Wajib Muncul Sebelum Hapus: Unduh Excel & PDF yang Bersangkutan */}
          <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-emerald-950 text-xs flex items-center gap-1.5">
                <Download className="w-4 h-4 text-emerald-700" />
                Unduh Arsip Nilai Terkait Sebelum Menghapus:
              </span>
              {(deleteModal.excelDownloaded || deleteModal.pdfDownloaded) && (
                <span className="text-[10px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded-full border border-emerald-200">
                  Siap Arsip ✓
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <Button
                type="button"
                variant="secondary"
                icon={FileSpreadsheet}
                onClick={() => handleDownloadTargetExcel()}
                className="justify-center border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100 font-bold"
              >
                {deleteModal.excelDownloaded
                  ? 'Excel Terunduh ✓'
                  : deleteModal.mode === 'single'
                    ? 'Unduh Excel Peserta (.xlsx)'
                    : `Unduh Excel Massal (${deleteModal.targets.length})`}
              </Button>

              <Button
                type="button"
                variant="primary"
                icon={Printer}
                onClick={handleDownloadTargetPdf}
                className="justify-center font-bold"
              >
                {deleteModal.pdfDownloaded
                  ? 'PDF Dibuka ✓'
                  : deleteModal.mode === 'single'
                    ? 'Unduh PDF Peserta (.pdf)'
                    : `Unduh PDF Lengkap (${deleteModal.targets.length})`}
              </Button>
            </div>

            <label className="flex items-center gap-2 pt-1 cursor-pointer text-[11px] text-emerald-900 font-medium">
              <input
                type="checkbox"
                checked={autoDownloadExcelOnDelete}
                onChange={(e) => setAutoDownloadExcelOnDelete(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span>Otomatis unduh file Excel (.xlsx) cadangan jika belum diunduh saat menekan Hapus Nilai</span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              disabled={deletingSubs}
              onClick={() => setDeleteModal(prev => ({ ...prev, open: false }))}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="danger"
              icon={Trash2}
              loading={deletingSubs}
              onClick={handleConfirmDeleteSubmissions}
            >
              {deletingSubs
                ? 'Menghapus...'
                : deleteModal.mode === 'single'
                  ? 'Hapus Nilai Peserta Ini'
                  : `Hapus ${deleteModal.targets.length} Nilai Sekarang`}
            </Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
};
