import React from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ShieldAlert } from 'lucide-react';

export const ViolationModal = ({ isOpen, onClose, violationCount, message }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Peringatan Integritas Ujian">
      <div className="text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-1">
          <h4 className="font-bold text-slate-800 text-base">
            Pelanggaran Terdeteksi!
          </h4>
          <p className="text-sm text-slate-600 leading-relaxed">
            {message || 'Anda terdeteksi meninggalkan halaman pengerjaan ujian atau berpindah aplikasi.'}
          </p>
        </div>

        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 text-left">
          <strong>Catatan:</strong> Seluruh aktivitas perpindahan tab direkam dan akan dilaporkan ke pengawas ujian.
          <span className="block mt-1 font-semibold text-rose-600">
            Total Pelanggaran Anda: {violationCount} kali
          </span>
        </div>

        <Button variant="danger" className="w-full" onClick={onClose}>
          Saya Mengerti & Kembali ke Ujian
        </Button>
      </div>
    </Modal>
  );
};
