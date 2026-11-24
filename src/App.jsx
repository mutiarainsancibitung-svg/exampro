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
import { ResultsPage } from './pages/admin/ResultsPage';

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
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin/dashboard" element={<DashboardPage />} />
            <Route path="/admin/questions" element={<QuestionBankPage />} />
            <Route path="/admin/results" element={<ResultsPage />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ExamProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
