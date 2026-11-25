import React from 'react';
import { NavLink } from 'react-router-dom';
import { Sliders, Calendar, BookOpen } from 'lucide-react';

export const ExamSubNav = ({ active = 1 }) => {
  const tabs = [
    {
      id: 1,
      label: '1. Atur Ujian & Pemetaan Kelas',
      path: '/admin/exam-setup',
      icon: Sliders,
      description: 'Pemetaan paket soal ke kelas sasaran'
    },
    {
      id: 2,
      label: '2. Data Mata Ujian / Kegiatan',
      path: '/admin/sessions',
      icon: Calendar,
      description: 'Kelola sesi, token & durasi pengerjaan'
    },
    {
      id: 3,
      label: '3. Data Bank Soal & Paket',
      path: '/admin/questions',
      icon: BookOpen,
      description: 'Template Excel & bank soal per paket'
    }
  ];

  return (
    <div className="bg-white p-2.5 rounded-3xl border border-kemenag-100 shadow-sm mb-6">
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((tab) => {
          const isSelected = active === tab.id;
          return (
            <NavLink
              key={tab.id}
              to={tab.path}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                isSelected
                  ? 'bg-kemenag-600 text-white shadow-sm shadow-kemenag-200'
                  : 'text-slate-600 hover:bg-kemenag-50 hover:text-kemenag-800'
              }`}
            >
              <tab.icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-kemenag-600'}`} />
              <span>{tab.label}</span>
            </NavLink>
          );
        })}
      </div>
    </div>
  );
};
