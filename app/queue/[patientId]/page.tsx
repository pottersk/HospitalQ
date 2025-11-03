'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Patient } from '@/types';

export default function QueueStatusPage() {
  const params = useParams();
  const patientId = params?.patientId as string;
  const [patient, setPatient] = useState<Patient | null>(null);
  const [queueNumber, setQueueNumber] = useState<number>(0);
  const [waitingCount, setWaitingCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!patientId) return;

    const fetchPatientData = async () => {
      try {
        // ลองหาข้อมูลจาก queue/patients ก่อน (คนที่ยังรออยู่)
        let response = await fetch(`https://hospital-queue-cc4c7-default-rtdb.asia-southeast1.firebasedatabase.app/queue/patients/${patientId}.json`);
        let data = await response.json();
        
        // ถ้าไม่พบใน queue ให้หาใน history (คนที่เสร็จสิ้นแล้ว)
        if (!data) {
          response = await fetch(`https://hospital-queue-cc4c7-default-rtdb.asia-southeast1.firebasedatabase.app/history/patients/${patientId}.json`);
          data = await response.json();
        }
        
        if (data) {
          setPatient({ ...data, firebaseId: patientId });
        } else {
          setPatient(null);
        }

        // Fetch all patients to calculate queue position (เฉพาะที่ยังรอในคิว)
        const allResponse = await fetch('https://hospital-queue-cc4c7-default-rtdb.asia-southeast1.firebasedatabase.app/queue/patients.json');
        const allData = await allResponse.json();
        
        if (allData) {
          const allPatients = Object.entries(allData).map(([id, p]: [string, any]) => ({
            ...p,
            firebaseId: id,
          })).sort((a, b) => a.timestamp - b.timestamp);

          const waitingPatients = allPatients.filter((p: Patient) => p.status === 'waiting');
          const inProgressPatients = allPatients.filter((p: Patient) => p.status === 'in-progress');
          const patientIndex = waitingPatients.findIndex((p: Patient) => p.firebaseId === patientId);
          
          setWaitingCount(waitingPatients.length);
          // คิวของคุณ = คนที่กำลังตรวจ + คนที่รออยู่ข้างหน้า + 1
          setQueueNumber(patientIndex >= 0 ? inProgressPatients.length + patientIndex + 1 : 0);
        } else {
          setWaitingCount(0);
          setQueueNumber(0);
        }

        setLoading(false);
      } catch (error) {
        console.error('Error fetching patient data:', error);
        setLoading(false);
      }
    };

    fetchPatientData();
    const interval = setInterval(fetchPatientData, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [patientId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-pink-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-pink-700 font-semibold">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-pink-50 flex items-center justify-center p-4">
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-8 max-w-md w-full text-center border border-pink-200">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">ไม่พบข้อมูลผู้ป่วย</h1>
          <p className="text-gray-600">กรุณาตรวจสอบ QR Code อีกครั้ง</p>
        </div>
      </div>
    );
  }

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'waiting':
        return {
          label: 'รอตรวจ',
          color: 'yellow',
          bgColor: 'bg-yellow-100',
          textColor: 'text-yellow-800',
          borderColor: 'border-yellow-300',
        };
      case 'in-progress':
        return {
          label: 'กำลังตรวจ',
          color: 'blue',
          bgColor: 'bg-blue-100',
          textColor: 'text-blue-800',
          borderColor: 'border-blue-300',
        };
      case 'completed':
        return {
          label: 'ตรวจเสร็จแล้ว',
          color: 'green',
          bgColor: 'bg-green-100',
          textColor: 'text-green-800',
          borderColor: 'border-green-300',
        };
      case 'cancelled':
        return {
          label: 'ยกเลิก',
          color: 'red',
          bgColor: 'bg-red-100',
          textColor: 'text-red-800',
          borderColor: 'border-red-300',
        };
      default:
        return {
          label: status,
          color: 'gray',
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-800',
          borderColor: 'border-gray-300',
        };
    }
  };

  const statusInfo = getStatusInfo(patient.status);

  const formatWaitTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours} ชั่วโมง ${minutes % 60} นาที`;
    }
    return `${minutes} นาที`;
  };

  // คำนวณเวลาโดยประมาณที่จะถึงคิว
  // (queueNumber - 1) เพราะไม่นับตัวเอง × 15 นาที/คน
  const estimatedWaitMinutes = patient.status === 'waiting' ? (queueNumber - 1) * 15 : 0;
  const estimatedTime = new Date(currentTime + estimatedWaitMinutes * 60 * 1000);
  const estimatedTimeString = estimatedTime.toLocaleTimeString('th-TH', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-pink-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        
        {/* Header Card - Department */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-3xl px-5 py-4 shadow-lg text-white text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
            </svg>
            <h2 className="text-xl font-bold">ห้องตรวจโรค</h2>
          </div>
          <p className="text-lg font-semibold leading-tight">ระบบหัวใจและหลอดเลือด</p>
        </div>

        {/* Main Content Card */}
        <div className="bg-white shadow-2xl rounded-b-3xl overflow-hidden">
          
          {/* Patient Info */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 px-5 py-6 border-b-2 border-blue-100">
            <div className="text-center mb-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full shadow-md mb-3">
                <svg className="w-9 h-9 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-3xl font-black text-gray-800 mb-1 break-words">{patient.name}</h3>
              {patient.hn && (
                <p className="text-base text-gray-600 font-semibold">HN: {patient.hn}</p>
              )}
            </div>

            {/* Doctor badges */}
            {patient.doctors && patient.doctors.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center">
                {patient.doctors.map((doctor) => (
                  <span key={doctor} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold bg-white text-blue-700 shadow-sm border border-blue-200">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/>
                    </svg>
                    {doctor}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Queue Status Display */}
          {patient.status === 'waiting' && (
            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 px-6 py-8">
              <div className="text-center mb-4">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-yellow-500 rounded-full shadow-lg mb-3">
                  <svg className="w-11 h-11 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-lg text-amber-700 font-bold mb-2">คิวของคุณ</p>
              </div>
              
              <div className="bg-white rounded-2xl shadow-xl p-6 mb-4">
                <div className="text-[120px] leading-none font-black text-transparent bg-clip-text bg-gradient-to-br from-yellow-500 to-orange-500 text-center">
                  {queueNumber}
                </div>
              </div>

              <div className="space-y-2 text-center">
                <div className="flex items-center justify-center gap-2 text-amber-800">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/>
                  </svg>
                  <p className="text-xl font-bold">รอตรวจอีก {waitingCount} คน</p>
                </div>
                <div className="bg-white rounded-xl px-4 py-3 shadow-md">
                  <p className="text-sm text-gray-600 font-semibold mb-1">เวลาโดยประมาณที่จะถึงคิว</p>
                  <p className="text-3xl text-amber-600 font-black">⏰ {estimatedTimeString} น.</p>
                </div>
              </div>
            </div>
          )}

          {patient.status === 'in-progress' && (
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 px-6 py-12 text-center">
              <div className="inline-flex items-center justify-center w-28 h-28 bg-blue-500 rounded-full shadow-2xl mb-5 animate-pulse">
                <svg className="w-16 h-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-5xl font-black text-blue-800 mb-3">ถึงคิวแล้ว</p>
              <p className="text-2xl text-blue-700 font-bold">กรุณาเข้าห้องตรวจ</p>
            </div>
          )}

          {patient.status === 'completed' && (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 px-6 py-12 text-center">
              <div className="inline-flex items-center justify-center w-28 h-28 bg-green-500 rounded-full shadow-2xl mb-5">
                <svg className="w-16 h-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-5xl font-black text-green-800 mb-3">เสร็จสิ้น</p>
              <p className="text-xl text-green-700 font-semibold">ขอบคุณที่ใช้บริการ</p>
            </div>
          )}

          {patient.status === 'cancelled' && (
            <div className="bg-gradient-to-br from-red-50 to-rose-50 px-6 py-12 text-center">
              <div className="inline-flex items-center justify-center w-28 h-28 bg-red-500 rounded-full shadow-2xl mb-5">
                <svg className="w-16 h-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-5xl font-black text-red-800 mb-3">ยกเลิกแล้ว</p>
              <p className="text-xl text-red-700 font-semibold">กรุณาติดต่อเจ้าหน้าที่</p>
            </div>
          )}

          {/* Footer Status */}
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-5 py-4 border-t border-gray-200">
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className={`inline-flex items-center px-4 py-2 rounded-full text-base font-bold shadow-sm ${statusInfo.bgColor} ${statusInfo.textColor} border-2 ${statusInfo.borderColor}`}>
                <span className="w-2 h-2 rounded-full bg-current mr-2 animate-pulse"></span>
                {statusInfo.label}
              </span>
            </div>
            <p className="text-xs text-gray-500 text-center flex items-center justify-center gap-1">
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              อัปเดตอัตโนมัติทุก 5 วินาที
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
