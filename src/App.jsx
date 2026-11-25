import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ExamProvider } from './context/ExamContext';

// Pages
import { TokenLoginPage } from './pages/user/TokenLoginPage';
import { ExamRoomPage } from './pages/user/ExamRoomPage';
import { ResultPage } from './pages/user/ResultPage';

import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { DashboardPage } from './pages/admin/DashboardPage';
import { QuestionBankPage } from './pages/admin/QuestionBankPage';
import { ParticipantsPage } from './pages/admin/ParticipantsPage';
import { ResultsPage } from './pages/admin/ResultsPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { ExamSetupPage } from './pages/admin/ExamSetupPage';
import { SessionsPage } from './pages/admin/SessionsPage';
import { BackupRestorePage } from './pages/admin/BackupRestorePage';
import { LiveMonitorPage } from './pages/admin/LiveMonitorPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ExamProvider>
          <Routes>
            {/* Rute Peserta Ujian */}
            <Route path="/" element={<TokenLoginPage />} />
            <Route path="/exam" element={<ExamRoomPage />} />
            <Route path="/result" element={<ResultPage />} />

            {/* Rute Panel Admin */}
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin/dashboard" element={<DashboardPage />} />
            <Route path="/admin/monitor" element={<LiveMonitorPage />} />
            <Route path="/admin/exam-setup" element={<ExamSetupPage />} />
            <Route path="/admin/sessions" element={<SessionsPage />} />
            <Route path="/admin/questions" element={<QuestionBankPage />} />
            <Route path="/admin/participants" element={<ParticipantsPage />} />
            <Route path="/admin/results" element={<ResultsPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/backup-restore" element={<BackupRestorePage />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ExamProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
