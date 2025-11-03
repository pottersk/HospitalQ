'use client';

import { useState, useRef, useEffect } from 'react';
import { useQueue } from '@/hooks/useQueue';
import type { Patient } from '@/types';
import { QRCodeCanvas } from 'qrcode.react';

const formatTime = (ms: number) => {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const statusInfo = {
  'waiting': {
    label: 'รอตรวจ',
    color: 'bg-yellow-400 text-yellow-900 border border-yellow-500'
  },
  'in-progress': {
    label: 'กำลังตรวจ',
    color: 'bg-green-500 text-white border border-green-600'
  },
  'completed': {
    label: 'เสร็จสิ้น',
    color: 'bg-blue-500 text-white border border-blue-600'
  },
  'cancelled': {
    label: 'ยกเลิก',
    color: 'bg-gray-400 text-white border border-gray-500'
  }
};

export default function NursePage() {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientHN, setNewPatientHN] = useState('');
  const [selectedDoctors, setSelectedDoctors] = useState<string[]>([]);
  const [newDoctorName, setNewDoctorName] = useState('');
  const [doctorList, setDoctorList] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [filterStatus, setFilterStatus] = useState<Patient['status'] | 'all'>('all');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [editingPatient, setEditingPatient] = useState<{id: string, name: string, hn: string, doctors: string[]} | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [printingQR, setPrintingQR] = useState<string | null>(null);
  const [showQRModal, setShowQRModal] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const qrPrintRef = useRef<HTMLDivElement>(null);

  const {
    patients,
    currentPatient,
    waitingCount,
    currentExamTime,
    isConnected,
    addPatient,
    callNextPatient,
    completeCurrentPatient,
    cancelPatient,
    skipCurrentPatient,
    updatePatient,
    deletePatient,
  } = useQueue();

  // ตรวจสอบสถานะการ login จาก localStorage เมื่อ component mount
  useEffect(() => {
    const authorized = localStorage.getItem('nurse_authorized') === 'true';
    setIsAuthorized(authorized);
  }, []);

  // โหลดรายชื่อแพทย์จาก Firebase
  useEffect(() => {
    const { ref, onValue } = require('@/lib/firebase');
    const { db } = require('@/lib/firebase');
    
    const doctorsRef = ref(db, 'doctors');
    const unsubscribe = onValue(doctorsRef, (snapshot: any) => {
      const data = snapshot.val();
      if (data && Array.isArray(data)) {
        setDoctorList(data);
      } else {
        setDoctorList([]);
      }
    });

    return () => unsubscribe();
  }, []);

  // อัปเดตเวลาทุกๆ 1 วินาที สำหรับนับเวลาตรวจผู้ป่วย
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus]);

  const handleAddDoctor = async () => {
    if (!newDoctorName.trim()) return;
    
    const { ref, set } = await import('@/lib/firebase');
    const { db } = await import('@/lib/firebase');
    
    const updatedList = [...doctorList, newDoctorName.trim()];
    await set(ref(db, 'doctors'), updatedList);
    setNewDoctorName('');
  };

  const handleRemoveDoctorFromList = async (doctorName: string) => {
    const { ref, set } = await import('@/lib/firebase');
    const { db } = await import('@/lib/firebase');
    
    const updatedList = doctorList.filter(d => d !== doctorName);
    await set(ref(db, 'doctors'), updatedList);
  };

  const handleToggleDoctor = (doctorName: string) => {
    setSelectedDoctors(prev => 
      prev.includes(doctorName)
        ? prev.filter(d => d !== doctorName)
        : [...prev, doctorName]
    );
  };

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !newPatientName.trim()) return;

    setBusy(true);
    try {
      await addPatient(
        newPatientName.trim(), 
        newPatientHN.trim() || undefined, 
        selectedDoctors.length > 0 ? selectedDoctors : undefined,
        undefined
      );
      
      setNewPatientName('');
      setNewPatientHN('');
      setSelectedDoctors([]);
      nameInputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  const handleAction = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  const handleEditPatient = (patient: any) => {
    setEditingPatient({
      id: patient.firebaseId,
      name: patient.name,
      hn: patient.hn || '',
      doctors: patient.doctors || []
    });
  };

  const handleSaveEdit = async () => {
    if (!editingPatient || busy) return;
    
    setBusy(true);
    try {
      await updatePatient(
        editingPatient.id, 
        editingPatient.name, 
        editingPatient.hn || undefined, 
        editingPatient.doctors.length > 0 ? editingPatient.doctors : undefined,
        undefined
      );
      setEditingPatient(null);
    } finally {
      setBusy(false);
    }
  };

  const handleDeletePatient = async (patientId: string, patientName: string) => {
    if (busy) return;
    
    if (!confirm(`ต้องการลบผู้ป่วย "${patientName}" ออกจากระบบใช่หรือไม่?`)) {
      return;
    }
    
    setBusy(true);
    try {
      await deletePatient(patientId);
    } finally {
      setBusy(false);
    }
  };

  const handleClearAll = async () => {
    if (!showClearConfirm) {
      setShowClearConfirm(true);
      setTimeout(() => setShowClearConfirm(false), 5000);
      return;
    }

    if (busy) return;
    setBusy(true);
    try {
      const { set, ref, db } = await import('@/lib/firebase');
      await set(ref(db, 'queue/patients'), null);
      await set(ref(db, 'history/patients'), null);
      await set(ref(db, 'queue/current'), null);
      setShowClearConfirm(false);
    } finally {
      setBusy(false);
    }
  };

  const handleLogin = () => {
    setIsAuthorized(true);
    localStorage.setItem('nurse_authorized', 'true');
  };

  const handleLogout = () => {
    setIsAuthorized(false);
    localStorage.removeItem('nurse_authorized');
  };

  const handlePrintQR = (patientId: string) => {
    setPrintingQR(patientId);
    setTimeout(() => {
      window.print();
      setPrintingQR(null);
    }, 100);
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-pink-100 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="rounded-[2rem] border-2 border-pink-100/80 bg-gradient-to-br from-white via-pink-50/30 to-white p-8 sm:p-10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-pink-200/30 to-transparent rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-pink-200/30 to-transparent rounded-full blur-3xl"></div>
            
            <div className="relative z-10">
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 rounded-[1.5rem] bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center shadow-2xl ring-4 ring-pink-100">
                  <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} 
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              </div>
              
              <div className="text-center mb-8">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-700 to-pink-500 mb-3">
                  หน้าสำหรับพยาบาล
                </h2>
                <p className="text-pink-600 font-semibold flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  กรุณาใส่รหัสผ่านเพื่อเข้าใช้งาน
                </p>
              </div>
              
              <div>
                <input
                  type="password"
                  className="w-full px-6 py-5 rounded-[1.5rem] border-2 border-pink-200/60 
                    focus:border-pink-500 focus:ring-4 focus:ring-pink-100 focus:outline-none 
                    text-center text-3xl tracking-[0.5em] font-bold text-pink-700
                    bg-white/80 backdrop-blur-sm shadow-lg
                    placeholder:tracking-normal placeholder:text-pink-300 placeholder:text-xl
                    transition-all duration-300"
                  placeholder="••••"
                  maxLength={4}
                  onChange={(e) => {
                    if (e.target.value === '1234') handleLogin();
                  }}
                />
                <div className="mt-4 text-center text-xs text-pink-500/80 font-medium">
                  กรอกรหัส PIN 4 หลัก
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const filteredPatients = patients.filter(p => filterStatus === 'all' || p.status === filterStatus);

  // Pagination
  const totalPages = Math.ceil(filteredPatients.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPatients = filteredPatients.slice(startIndex, endIndex);

  return (
    <>
        {/* Left Panel - Add Patient & Current Patient */}
        <div className="fixed left-0 top-0 w-full lg:w-1/3 h-auto lg:h-screen flex flex-col gap-3 lg:gap-4 p-3 lg:p-6 bg-gradient-to-br from-pink-50 via-pink-50/30 to-white overflow-y-auto z-10 lg:z-auto print:hidden">
              {/* Add Patient Form */}
              <div className="rounded-xl border border-pink-200/40 bg-white/90 backdrop-blur-xl p-4 shadow-lg shadow-pink-500/5 hover:shadow-xl hover:shadow-pink-500/10 transition-all duration-300">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center shadow-md">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <h2 className="text-base font-bold text-pink-900">
                    เพิ่มผู้ป่วยใหม่
                  </h2>
                </div>
                <form onSubmit={handleAddPatient} className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-pink-800 mb-1">
                        ชื่อ-นามสกุล
                      </label>
                      <input
                        ref={nameInputRef}
                        type="text"
                        value={newPatientName}
                        onChange={(e) => setNewPatientName(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-pink-200
                          focus:border-pink-500 focus:ring-2 focus:ring-pink-200 focus:outline-none 
                          transition-all bg-white/70 hover:bg-white
                          placeholder:text-pink-300 text-pink-900"
                        placeholder="ชื่อผู้ป่วย"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-pink-800 mb-1">
                        เลข HN
                      </label>
                      <input
                        type="text"
                        value={newPatientHN}
                        onChange={(e) => setNewPatientHN(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-pink-200
                          focus:border-pink-500 focus:ring-2 focus:ring-pink-200 focus:outline-none 
                          transition-all bg-white/70 hover:bg-white
                          placeholder:text-pink-300 text-pink-900"
                        placeholder="HN"
                      />
                    </div>
                  </div>
                  
                  {/* Doctor Selection */}
                  <div>
                    <label className="block text-xs font-semibold text-pink-800 mb-1">
                      แพทย์ผู้ตรวจ
                    </label>
                    
                    {/* Add New Doctor - Compact */}
                    <div className="flex gap-1.5 mb-1.5">
                      <input
                        type="text"
                        value={newDoctorName}
                        onChange={(e) => setNewDoctorName(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddDoctor();
                          }
                        }}
                        className="flex-1 px-2.5 py-1.5 text-xs rounded-md border border-pink-200
                          focus:border-pink-500 focus:ring-1 focus:ring-pink-200 focus:outline-none 
                          transition-all bg-white/70 hover:bg-white
                          placeholder:text-pink-300 text-pink-900"
                        placeholder="เพิ่มแพทย์..."
                      />
                      <button
                        type="button"
                        onClick={handleAddDoctor}
                        disabled={!newDoctorName.trim()}
                        className="px-3 py-1.5 text-xs rounded-md bg-blue-500 text-white font-semibold hover:bg-blue-600
                          focus:outline-none focus:ring-2 focus:ring-blue-300
                          disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-sm"
                      >
                        +
                      </button>
                    </div>
                    
                    {/* Doctor List - More Compact */}
                    <div className="flex flex-wrap gap-1 min-h-[1.75rem] p-1.5 rounded-md border border-pink-200 bg-white/70">
                      {doctorList.length === 0 ? (
                        <span className="text-xs text-pink-400">ยังไม่มีรายชื่อแพทย์</span>
                      ) : (
                        doctorList.map((doctor) => (
                          <div
                            key={doctor}
                            onClick={() => handleToggleDoctor(doctor)}
                            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs rounded cursor-pointer transition-all
                              ${selectedDoctors.includes(doctor)
                                ? 'bg-pink-500 text-white shadow-sm'
                                : 'bg-pink-100 text-pink-700 hover:bg-pink-200'
                              }`}
                          >
                            <span className="text-[11px]">{doctor}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveDoctorFromList(doctor);
                              }}
                              className="hover:text-red-500 transition-colors ml-0.5"
                              title="ลบ"
                            >
                              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                    
                    {/* Selected Doctors Display - More Compact */}
                    {selectedDoctors.length > 0 && (
                      <div className="mt-1 text-[11px] text-pink-600 bg-pink-50/50 px-2 py-1 rounded">
                        <span className="font-semibold">เลือก:</span> {selectedDoctors.join(', ')}
                      </div>
                    )}
                  </div>
                  
                  <button
                    type="submit"
                    disabled={busy || !newPatientName.trim()}
                    className="w-full py-2.5 text-sm rounded-lg bg-gradient-to-r from-pink-500 to-pink-600
                      text-white font-bold hover:from-pink-600 hover:to-pink-700
                      focus:outline-none focus:ring-2 focus:ring-pink-300 focus:ring-offset-1
                      disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed
                      transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg
                      hover:scale-[1.01] active:scale-[0.99]"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span>{busy ? 'กำลังเพิ่ม...' : 'เพิ่มผู้ป่วย'}</span>
                  </button>
                </form>
              </div>

              {/* Current Patient */}
              <div className="rounded-xl border border-green-200/40 bg-white/90 backdrop-blur-xl p-4 shadow-lg shadow-green-500/5 hover:shadow-xl hover:shadow-green-500/10 transition-all duration-300 flex flex-col overflow-hidden">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-md">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} 
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h2 className="text-base font-bold text-pink-900">
                    ผู้ป่วยที่กำลังตรวจ
                  </h2>
                </div>
                {currentPatient ? (
                  <div className="space-y-2.5">
                    <div className="text-center p-3 rounded-lg bg-gradient-to-br from-white to-pink-50/50 border border-pink-200/60 shadow-md">
                      <div className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-pink-500 mb-1.5 break-words">
                        {currentPatient.name}
                      </div>
                      {currentPatient.note && (
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-pink-50 to-pink-100/50 border border-pink-200/60 text-xs text-pink-700 font-bold shadow-sm">
                          <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} 
                              d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                          </svg>
                          <span className="text-[11px] font-bold">HN: {currentPatient.note}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-center p-2.5 rounded-lg bg-gradient-to-r from-pink-100/60 to-pink-50/40 border border-pink-200/60 shadow-sm">
                      <div className="flex items-center justify-center gap-2 text-pink-700">
                        <div className="w-7 h-7 rounded-full bg-white border-2 border-pink-300 flex items-center justify-center shadow-sm">
                          <svg className="w-3.5 h-3.5 text-pink-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} 
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <span className="font-extrabold text-sm">
                          เวลาตรวจ: {formatTime(currentPatient.startTime ? currentTime - currentPatient.startTime : 0)}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleAction(completeCurrentPatient)}
                        disabled={busy}
                        className="py-2 text-sm rounded-lg bg-gradient-to-r from-green-500 to-green-600 text-white font-bold
                          hover:from-green-600 hover:to-green-700 focus:outline-none focus:ring-2 focus:ring-green-200
                          disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed
                          transition-all duration-200 flex items-center justify-center gap-1.5 shadow-md hover:shadow-lg
                          hover:scale-[1.02] active:scale-[0.98]"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>เสร็จสิ้น</span>
                      </button>
                      <button
                        onClick={() => handleAction(skipCurrentPatient)}
                        disabled={busy}
                        className="py-2 text-sm rounded-lg bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold
                          hover:from-yellow-600 hover:to-orange-600 focus:outline-none focus:ring-2 focus:ring-yellow-200
                          disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed
                          transition-all duration-200 flex items-center justify-center gap-1.5 shadow-md hover:shadow-lg
                          hover:scale-[1.02] active:scale-[0.98]"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                        </svg>
                        <span>ข้ามคิว</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <div className="mb-3">
                      <svg className="w-12 h-12 mx-auto text-pink-200 mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <div className="text-xs text-pink-400 font-medium">ไม่มีผู้ป่วยที่กำลังตรวจ</div>
                    </div>
                    <button
                      onClick={() => handleAction(callNextPatient)}
                      disabled={busy || waitingCount === 0}
                      className="px-5 py-2 text-sm rounded-lg bg-gradient-to-r from-pink-600 to-pink-500 text-white font-bold
                        hover:from-pink-500 hover:to-pink-600 focus:outline-none focus:ring-2 focus:ring-pink-200
                        disabled:from-pink-300 disabled:to-pink-300 disabled:cursor-not-allowed
                        transition-all duration-200 inline-flex items-center gap-2 shadow-md hover:shadow-lg
                        active:scale-[0.98]"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <span className="whitespace-nowrap">{waitingCount === 0 ? 'ไม่มีคิวรอ' : `เรียกคิวถัดไป (${waitingCount})`}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* System Controls */}
              <div className="rounded-xl border border-gray-200/40 bg-white/90 backdrop-blur-xl p-4 shadow-lg shadow-gray-500/5 hover:shadow-xl hover:shadow-gray-500/10 transition-all duration-300">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center shadow-md">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} 
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <h2 className="text-base font-bold text-pink-900">
                    การจัดการระบบ
                  </h2>
                </div>

                <div className="space-y-2">
                  {/* Connection Status */}
                  <div className="flex items-center justify-between p-2 rounded-lg bg-gradient-to-r from-gray-50 to-white border border-gray-200">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                      <span className="text-xs font-medium text-gray-700">สถานะ</span>
                    </div>
                    <span className={`text-xs font-bold ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                      {isConnected ? 'เชื่อมต่อแล้ว' : 'ไม่ได้เชื่อมต่อ'}
                    </span>
                  </div>

                  {/* Clear All Data Button */}
                  <button
                    onClick={handleClearAll}
                    disabled={busy}
                    className={`w-full py-2 text-sm rounded-lg font-bold
                      focus:outline-none focus:ring-2 focus:ring-offset-1
                      disabled:opacity-50 disabled:cursor-not-allowed
                      transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg
                      hover:scale-[1.01] active:scale-[0.99]
                      ${showClearConfirm 
                        ? 'bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800 focus:ring-red-300' 
                        : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 focus:ring-orange-300'
                      }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} 
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span className="text-xs">{showClearConfirm ? 'คลิกอีกครั้งเพื่อยืนยัน' : 'ลบข้อมูลทั้งหมด'}</span>
                  </button>

                  {/* Logout Button */}
                  <button
                    onClick={handleLogout}
                    disabled={busy}
                    className="w-full py-2 text-sm rounded-lg bg-gradient-to-r from-gray-500 to-gray-600
                      text-white font-bold hover:from-gray-600 hover:to-gray-700
                      focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-1
                      disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed
                      transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg
                      hover:scale-[1.01] active:scale-[0.99]"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} 
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>ออกจากระบบ</span>
                  </button>
                </div>
              </div>
        </div>

        {/* Right Panel - Patient List Table */}
        <div className="fixed left-0 lg:right-0 top-auto lg:top-0 bottom-0 lg:left-auto w-full lg:w-2/3 h-[60vh] lg:h-screen flex flex-col overflow-hidden p-4 lg:p-8 lg:pl-6 bg-gradient-to-br from-pink-50 via-pink-50/30 to-white print:hidden">
          <div className="h-full flex flex-col rounded-t-3xl lg:rounded-3xl border border-pink-200/50 bg-white/90 backdrop-blur-xl shadow-2xl shadow-pink-500/10 overflow-hidden">
              <div className="px-4 py-4 lg:px-6 lg:py-5 flex-shrink-0 border-b border-pink-200 bg-gradient-to-r from-pink-50 to-white">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 lg:gap-4">
                  <div>
                    <h2 className="text-lg lg:text-2xl font-bold text-pink-900">
                      รายชื่อผู้ป่วย
                    </h2>
                    <p className="text-xs lg:text-sm text-pink-700 mt-0.5 lg:mt-1">
                      ทั้งหมด {filteredPatients.length} คน
                    </p>
                  </div>
                  <div className="flex gap-1.5 lg:gap-2 w-full lg:w-auto overflow-x-auto">
                    <button
                      onClick={() => setFilterStatus('all')}
                      className={`px-3 py-2 lg:px-5 lg:py-2.5 rounded-lg lg:rounded-xl text-xs lg:text-sm font-semibold transition-all whitespace-nowrap
                        ${filterStatus === 'all'
                          ? 'bg-pink-500 text-white shadow-lg'
                          : 'bg-pink-100 text-pink-700 hover:bg-pink-200'
                        }`}
                    >
                      ทั้งหมด
                    </button>
                    <button
                      onClick={() => setFilterStatus('waiting')}
                      className={`px-3 py-2 lg:px-5 lg:py-2.5 rounded-lg lg:rounded-xl text-xs lg:text-sm font-semibold transition-all whitespace-nowrap
                        ${filterStatus === 'waiting'
                          ? 'bg-pink-400 text-white shadow-lg'
                          : 'bg-pink-100 text-pink-700 hover:bg-pink-200'
                        }`}
                    >
                      รอตรวจ
                    </button>
                    <button
                      onClick={() => setFilterStatus('completed')}
                      className={`px-3 py-2 lg:px-5 lg:py-2.5 rounded-lg lg:rounded-xl text-xs lg:text-sm font-semibold transition-all whitespace-nowrap
                        ${filterStatus === 'completed'
                          ? 'bg-pink-600 text-white shadow-lg'
                          : 'bg-pink-100 text-pink-700 hover:bg-pink-200'
                        }`}
                    >
                      เสร็จสิ้น
                    </button>
                  </div>
                </div>
              </div>
                
                            <div className="flex-1 overflow-auto min-h-0">
                  <table className="w-full">
                      <thead className="sticky top-0 bg-gradient-to-r from-pink-50 to-white border-b-2 border-pink-200 z-10">
                      <tr>
                        <th className="px-3 lg:px-6 py-3 lg:py-4 text-left text-xs lg:text-sm font-bold text-pink-700 w-12 lg:w-20">ลำดับ</th>
                        <th className="px-3 lg:px-6 py-3 lg:py-4 text-left text-xs lg:text-sm font-bold text-pink-700">ชื่อ-นามสกุล</th>
                        <th className="hidden md:table-cell px-3 lg:px-6 py-3 lg:py-4 text-left text-xs lg:text-sm font-bold text-pink-700 w-24 lg:w-32">สถานะ</th>
                        <th className="hidden lg:table-cell px-6 py-4 text-left text-sm font-bold text-pink-700 w-36">HN</th>
                        <th className="hidden lg:table-cell px-6 py-4 text-left text-sm font-bold text-pink-700 w-48">แพทย์</th>
                        <th className="px-3 lg:px-6 py-3 lg:py-4 text-left text-xs lg:text-sm font-bold text-pink-700 w-20 lg:w-36">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentPatients.map((patient, index) => (
                        <tr 
                          key={patient.firebaseId}
                          className="border-b border-pink-100 hover:bg-pink-50/50 transition-all duration-150"
                        >
                          <td className="px-3 lg:px-6 py-3 lg:py-4 align-middle">
                            <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-gradient-to-br from-pink-500 to-pink-600 text-white font-bold flex items-center justify-center text-xs lg:text-sm shadow-md flex-shrink-0">
                              {index + 1}
                            </div>
                          </td>
                          <td className="px-3 lg:px-6 py-3 lg:py-4 align-middle">
                            {editingPatient?.id === patient.firebaseId ? (
                              <input
                                type="text"
                                value={editingPatient.name}
                                onChange={(e) => setEditingPatient({...editingPatient, name: e.target.value})}
                                className="w-full px-2 lg:px-3 py-1.5 lg:py-2 text-xs lg:text-sm border-2 border-pink-300 rounded-lg focus:border-pink-500 focus:ring-2 focus:ring-pink-200 focus:outline-none shadow-sm"
                                autoFocus
                              />
                            ) : (
                              <div>
                                <div className="font-semibold text-sm lg:text-base text-pink-900" title={patient.name}>{patient.name}</div>
                                <div className="md:hidden mt-1">
                                  <span className={`inline-flex items-center justify-center px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap ${statusInfo[patient.status].color} shadow-sm`}>
                                    {statusInfo[patient.status].label}
                                  </span>
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="hidden md:table-cell px-3 lg:px-6 py-3 lg:py-4 align-middle">
                            <span className={`inline-flex items-center justify-center px-3 lg:px-4 py-1.5 lg:py-2 rounded-full text-xs lg:text-sm font-bold whitespace-nowrap ${statusInfo[patient.status].color} shadow-sm`}>
                              {statusInfo[patient.status].label}
                            </span>
                          </td>
                          <td className="hidden lg:table-cell px-6 py-4 align-middle">
                            {editingPatient?.id === patient.firebaseId ? (
                              <input
                                type="text"
                                value={editingPatient.hn}
                                onChange={(e) => setEditingPatient({...editingPatient, hn: e.target.value})}
                                className="w-full px-3 py-2 text-sm border-2 border-pink-300 rounded-lg focus:border-pink-500 focus:ring-2 focus:ring-pink-200 focus:outline-none shadow-sm"
                                placeholder="HN"
                              />
                            ) : (
                              <div className="text-sm text-pink-700 font-medium" title={patient.hn || ''}>{patient.hn || '-'}</div>
                            )}
                          </td>
                          <td className="hidden lg:table-cell px-6 py-4 align-middle">
                            {editingPatient?.id === patient.firebaseId ? (
                              <div className="flex flex-wrap gap-1">
                                {doctorList.map((doctor) => (
                                  <button
                                    key={doctor}
                                    type="button"
                                    onClick={() => {
                                      const doctors = editingPatient.doctors.includes(doctor)
                                        ? editingPatient.doctors.filter(d => d !== doctor)
                                        : [...editingPatient.doctors, doctor];
                                      setEditingPatient({...editingPatient, doctors});
                                    }}
                                    className={`px-2 py-1 text-xs rounded-md transition-all
                                      ${editingPatient.doctors.includes(doctor)
                                        ? 'bg-pink-500 text-white'
                                        : 'bg-pink-100 text-pink-700 hover:bg-pink-200'
                                      }`}
                                  >
                                    {doctor}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {patient.doctors && patient.doctors.length > 0 ? (
                                  patient.doctors.map((doctor) => (
                                    <span key={doctor} className="inline-flex items-center px-2 py-1 text-xs rounded-md bg-pink-100 text-pink-700 font-medium">
                                      {doctor}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-sm text-pink-400">-</span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-3 lg:px-6 py-3 lg:py-4 align-middle">
                            <div className="flex items-center gap-1 lg:gap-2">
                              {editingPatient?.id === patient.firebaseId ? (
                                <>
                                  <button
                                    onClick={handleSaveEdit}
                                    disabled={busy}
                                    className="inline-flex items-center justify-center w-7 h-7 lg:w-9 lg:h-9 rounded-md lg:rounded-lg bg-green-500 text-white hover:bg-green-600
                                      focus:outline-none focus:ring-2 focus:ring-green-300
                                      disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg active:scale-95"
                                    title="บันทึก"
                                  >
                                    <svg className="w-4 h-4 lg:w-5 lg:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => setEditingPatient(null)}
                                    disabled={busy}
                                    className="inline-flex items-center justify-center w-7 h-7 lg:w-9 lg:h-9 rounded-md lg:rounded-lg bg-pink-300 text-white hover:bg-pink-400
                                      focus:outline-none focus:ring-2 focus:ring-pink-200
                                      disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg active:scale-95"
                                    title="ยกเลิก"
                                  >
                                    <svg className="w-4 h-4 lg:w-5 lg:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleEditPatient(patient)}
                                    disabled={busy}
                                    className="inline-flex items-center justify-center w-7 h-7 lg:w-9 lg:h-9 rounded-md lg:rounded-lg bg-pink-500 text-white hover:bg-pink-600
                                      focus:outline-none focus:ring-2 focus:ring-pink-300
                                      disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg active:scale-95"
                                    title="แก้ไข"
                                  >
                                    <svg className="w-4 h-4 lg:w-5 lg:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => window.open(`/queue/${patient.firebaseId}`, '_blank')}
                                    disabled={busy}
                                    className="inline-flex items-center justify-center w-7 h-7 lg:w-9 lg:h-9 rounded-md lg:rounded-lg bg-purple-500 text-white hover:bg-purple-600
                                      focus:outline-none focus:ring-2 focus:ring-purple-300
                                      disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg active:scale-95"
                                    title="เปิดลิ้งผู้ป่วย"
                                  >
                                    <svg className="w-4 h-4 lg:w-5 lg:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handlePrintQR(patient.firebaseId)}
                                    disabled={busy}
                                    className="inline-flex items-center justify-center w-7 h-7 lg:w-9 lg:h-9 rounded-md lg:rounded-lg bg-blue-500 text-white hover:bg-blue-600
                                      focus:outline-none focus:ring-2 focus:ring-blue-300
                                      disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg active:scale-95"
                                    title="พิมพ์ QR"
                                  >
                                    <svg className="w-4 h-4 lg:w-5 lg:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleDeletePatient(patient.firebaseId, patient.name)}
                                    disabled={busy}
                                    className="inline-flex items-center justify-center w-7 h-7 lg:w-9 lg:h-9 rounded-md lg:rounded-lg bg-pink-400 text-white hover:bg-pink-500
                                      focus:outline-none focus:ring-2 focus:ring-pink-300
                                      disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg active:scale-95"
                                    title="ลบ"
                                  >
                                    <svg className="w-4 h-4 lg:w-5 lg:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredPatients.length === 0 && (
                    <div className="text-center py-12">
                      <svg className="w-16 h-16 mx-auto text-pink-200 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div className="text-sm text-pink-400 font-medium">ไม่พบรายการที่ตรงกับเงื่อนไข</div>
                    </div>
                  )}

                  {/* Pagination Controls */}
                  {filteredPatients.length > itemsPerPage && (
                    <div className="px-4 lg:px-6 py-4 border-t border-pink-200 bg-gradient-to-r from-pink-50/50 to-white">
                      <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
                        <div className="text-sm text-pink-700 font-medium">
                          แสดง {startIndex + 1}-{Math.min(endIndex, filteredPatients.length)} จาก {filteredPatients.length} คน
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                            className="px-3 py-2 rounded-lg text-sm font-semibold transition-all
                              disabled:opacity-40 disabled:cursor-not-allowed
                              enabled:bg-pink-100 enabled:text-pink-700 enabled:hover:bg-pink-200 enabled:active:scale-95"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-2 rounded-lg text-sm font-semibold transition-all
                              disabled:opacity-40 disabled:cursor-not-allowed
                              enabled:bg-pink-100 enabled:text-pink-700 enabled:hover:bg-pink-200 enabled:active:scale-95"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>
                          
                          <div className="flex items-center gap-1">
                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                              .filter(page => {
                                // Show first page, last page, current page, and neighbors
                                return page === 1 || 
                                       page === totalPages || 
                                       Math.abs(page - currentPage) <= 1;
                              })
                              .map((page, idx, arr) => (
                                <div key={page} className="flex items-center gap-1">
                                  {idx > 0 && arr[idx - 1] !== page - 1 && (
                                    <span className="px-2 text-pink-400">...</span>
                                  )}
                                  <button
                                    onClick={() => setCurrentPage(page)}
                                    className={`min-w-[2.5rem] px-3 py-2 rounded-lg text-sm font-bold transition-all
                                      ${currentPage === page
                                        ? 'bg-pink-500 text-white shadow-lg scale-105'
                                        : 'bg-pink-100 text-pink-700 hover:bg-pink-200 active:scale-95'
                                      }`}
                                  >
                                    {page}
                                  </button>
                                </div>
                              ))
                            }
                          </div>

                          <button
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className="px-3 py-2 rounded-lg text-sm font-semibold transition-all
                              disabled:opacity-40 disabled:cursor-not-allowed
                              enabled:bg-pink-100 enabled:text-pink-700 enabled:hover:bg-pink-200 enabled:active:scale-95"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages}
                            className="px-3 py-2 rounded-lg text-sm font-semibold transition-all
                              disabled:opacity-40 disabled:cursor-not-allowed
                              enabled:bg-pink-100 enabled:text-pink-700 enabled:hover:bg-pink-200 enabled:active:scale-95"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
              </div>
          </div>
        </div>

      {/* QR Code Modal - Show after adding patient */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative animate-in fade-in zoom-in duration-200">
            {/* Close Button */}
            <button
              onClick={() => setShowQRModal(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Content */}
            {(() => {
              const patient = patients.find(p => p.firebaseId === showQRModal);
              if (!patient) return <div>ไม่พบข้อมูลผู้ป่วย</div>;

              const queueNumber = patients
                .filter(p => p.status === 'waiting')
                .findIndex(p => p.firebaseId === patient.firebaseId) + 1;

              return (
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  
                  <h2 className="text-2xl font-bold text-pink-900 mb-2">เพิ่มผู้ป่วยสำเร็จ!</h2>
                  <p className="text-gray-600 mb-6">QR Code สำหรับติดตามคิว</p>

                  {/* Patient Info */}
                  <div className="bg-pink-50 rounded-xl p-4 mb-4 text-left">
                    <p className="text-sm text-pink-900 mb-1"><span className="font-semibold">ชื่อ:</span> {patient.name}</p>
                    {patient.hn && (
                      <p className="text-sm text-pink-900 mb-1"><span className="font-semibold">HN:</span> {patient.hn}</p>
                    )}
                    {patient.doctors && patient.doctors.length > 0 && (
                      <p className="text-sm text-pink-900 mb-1">
                        <span className="font-semibold">แพทย์:</span> {patient.doctors.join(', ')}
                      </p>
                    )}
                    <p className="text-sm text-pink-900"><span className="font-semibold">คิวที่:</span> {queueNumber}</p>
                  </div>

                  {/* QR Code */}
                  <div className="bg-white p-4 rounded-xl border-2 border-pink-200 inline-block mb-4">
                    <QRCodeCanvas
                      value={`${window.location.origin}/queue/${patient.firebaseId}`}
                      size={200}
                      level="H"
                      includeMargin={true}
                    />
                  </div>

                  {/* Link */}
                  <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <p className="text-xs text-gray-600 mb-1">ลิงก์สำหรับตรวจสอบคิว</p>
                    <p className="text-xs text-pink-600 font-mono break-all">
                      {`${window.location.origin}/queue/${patient.firebaseId}`}
                    </p>
                  </div>

                  {/* Buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handlePrintQR(patient.firebaseId)}
                      className="py-2.5 px-4 rounded-lg bg-blue-500 text-white font-semibold hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 shadow-md"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      พิมพ์
                    </button>
                    <button
                      onClick={() => setShowQRModal(null)}
                      className="py-2.5 px-4 rounded-lg bg-pink-500 text-white font-semibold hover:bg-pink-600 transition-colors shadow-md"
                    >
                      ปิด
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Print QR Template */}
      {printingQR && (
        <div ref={qrPrintRef} className="fixed inset-0 bg-white hidden print:block">
          <style dangerouslySetInnerHTML={{__html: `
            @media print {
              @page {
                size: A5 portrait;
                margin: 15mm;
              }
              body {
                margin: 0;
                padding: 0;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
          `}} />
          
          <div className="w-full h-full">
            {(() => {
              const patient = patients.find(p => p.firebaseId === printingQR);
              if (!patient) return null;
              
              const queueNumber = patients
                .filter(p => p.status === 'waiting')
                .findIndex(p => p.firebaseId === patient.firebaseId) + 1;
              
              return (
                <div className="flex flex-col">
                  {/* Header - Department Name */}
                  <div className="text-center mb-3 pb-2 border-b-4 border-blue-600">
                    <h1 className="text-xl font-black text-blue-800 leading-tight">
                      ห้องตรวจโรคระบบหัวใจและหลอดเลือด
                    </h1>
                  </div>

                  {/* Patient Info Card */}
                  <div className="border-3 border-blue-400 rounded-lg p-3 mb-3 bg-blue-50">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-xs font-bold text-gray-600">ชื่อผู้ป่วย</p>
                        <p className="text-lg font-black text-gray-900 leading-tight">{patient.name}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-600">HN</p>
                        <p className="text-lg font-black text-gray-900">{patient.hn || '-'}</p>
                      </div>
                    </div>
                    {patient.doctors && patient.doctors.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-blue-200">
                        <p className="text-xs font-bold text-gray-600">แพทย์ผู้ตรวจ</p>
                        <p className="text-base font-bold text-blue-700">{patient.doctors.join(', ')}</p>
                      </div>
                    )}
                    <div className="mt-2 pt-2 border-t border-blue-200 text-center">
                      <p className="text-xs font-bold text-gray-600">คิวของคุณ</p>
                      <p className="text-4xl font-black text-blue-600">{queueNumber}</p>
                    </div>
                  </div>
                  
                  {/* QR Code Section */}
                  <div className="flex flex-col items-center mb-3">
                    <div className="border-4 border-gray-300 rounded-xl p-2 bg-white">
                      <QRCodeCanvas
                        value={`${window.location.origin}/queue/${patient.firebaseId}`}
                        size={160}
                        level="H"
                        includeMargin={false}
                      />
                    </div>
                    <p className="text-center text-xs font-bold text-gray-700 mt-1">
                      สแกน QR Code เพื่อตรวจสอบสถานะคิว
                    </p>
                  </div>
                  
                  {/* Instructions */}
                  <div className="border-3 border-yellow-400 rounded-lg p-2.5 bg-yellow-50">
                    <h3 className="font-black text-sm mb-1.5 text-gray-900">📱 วิธีใช้งาน</h3>
                    <ol className="space-y-0.5 text-xs font-semibold text-gray-800 leading-relaxed">
                      <li>1. เข้าแอปพลิเคชัน Line</li>
                      <li>2. สแกน QR Code</li>
                      <li>3. เข้ามาห้องตรวจก่อนถึงคิวอย่างน้อย 15-30 นาที</li>
                    </ol>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </>
  );
}