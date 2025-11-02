'use client';

import { useState, useEffect } from 'react';
import { useQueue } from '@/hooks/useQueue';
import { db, ref, runTransaction, update, onValue } from '@/lib/firebase';
import { DataSnapshot } from 'firebase/database';

function InfoCard({ label, value, highlight = false }: { label: string | React.ReactNode; value: any; highlight?: boolean }) {
  return (
    <div className={`
      text-center p-4 sm:p-6 rounded-3xl border-2 
      ${highlight 
        ? 'border-pink-300 bg-gradient-to-br from-pink-50 to-white shadow-lg' 
        : 'border-pink-100 bg-white hover:shadow-lg'
      } 
      transition-all duration-200 group relative overflow-hidden
    `}>
      <div className="text-pink-600 text-sm sm:text-base font-medium mb-1 relative z-10">{label}</div>
      <div className={`
        text-3xl sm:text-4xl font-extrabold relative z-10
        ${highlight ? 'text-pink-600' : 'text-pink-800'} 
        group-hover:scale-105 transition-transform duration-200
      `}>
        {value}
      </div>
      {highlight && (
        <div className="absolute inset-0 bg-gradient-to-br from-pink-100/50 to-transparent opacity-50" />
      )}
    </div>
  );
}

import { PinPad } from '@/components/PinPad';

export default function NursePage() {
  const { currentNumber, nextNumber, hasWaitingQueue, queueLength, isConnected } = useQueue();
  const [busy, setBusy] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  // ตรวจสอบสถานะการ login จาก localStorage เมื่อ component mount
  useEffect(() => {
    const authorized = localStorage.getItem('nurse_authorized') === 'true';
    setIsAuthorized(authorized);
  }, []);

  // ฟังก์ชันตรวจสอบคิวที่ถูกยกเลิก
  const checkIfTicketCancelled = async (ticketNumber: number) => {
    const cancelledRef = ref(db, `queue/cancelled/${ticketNumber}`);
    try {
      const snapshot = await new Promise<DataSnapshot>((resolve, reject) => {
        onValue(cancelledRef, resolve, reject, { onlyOnce: true });
      });
      return snapshot.exists();
    } catch (error) {
      console.error('Error checking cancelled ticket:', error);
      return false;
    }
  };

  // ฟังก์ชันตรวจสอบว่าคิวนี้มีอยู่จริงหรือไม่
  const checkIfTicketExists = async (ticketNumber: number) => {
    const ticketRef = ref(db, `queue/tickets/${ticketNumber}`);
    try {
      const snapshot = await new Promise<DataSnapshot>((resolve, reject) => {
        onValue(ticketRef, resolve, reject, { onlyOnce: true });
      });
      return snapshot.exists();
    } catch (error) {
      console.error('Error checking ticket existence:', error);
      return false;
    }
  };

  const callNext = async () => {
    // ถ้ากำลังทำงานอยู่หรือไม่มีคิวที่รออยู่ → ไม่ต้องทำอะไร
    if (busy || !hasWaitingQueue) return;
    
    setBusy(true);
    try {
      const nextTicket = currentNumber + 1;
      const isCancelled = await checkIfTicketCancelled(nextTicket);
      const ticketExists = await checkIfTicketExists(nextTicket);

      if (!ticketExists) {
        // ถ้าไม่มีคิวนี้อยู่ในระบบ
        alert(`ไม่พบคิวที่ ${nextTicket} ในระบบ`);
        return;
      }

      if (isCancelled) {
        // ถ้าคิวถูกยกเลิก แจ้งเตือนและข้ามไปคิวถัดไป
        alert(`คิวที่ ${nextTicket} ถูกยกเลิกแล้ว`);
        const nextTicket2 = nextTicket + 1;
        const ticket2Exists = await checkIfTicketExists(nextTicket2);
        const ticket2Cancelled = await checkIfTicketCancelled(nextTicket2);
        
        if (ticket2Exists && !ticket2Cancelled) {
          // ถ้าคิวถัดไปมีอยู่และไม่ถูกยกเลิก
          const curRef = ref(db, 'queue/global/currentNumber');
          await runTransaction(curRef, (cur) => {
            const curVal = Number.isFinite(cur) ? cur : 0;
            return curVal + 2; // ข้ามไป 2 คิว
          });
          alert(`กำลังข้ามไปเรียกคิวที่ ${nextTicket2}`);
        } else {
          alert('ไม่พบคิวถัดไปที่สามารถเรียกได้');
          return;
        }
      } else {
        // ถ้าคิวไม่ถูกยกเลิก เรียกคิวถัดไปตามปกติ
        const curRef = ref(db, 'queue/global/currentNumber');
        await runTransaction(curRef, (cur) => {
          const curVal = Number.isFinite(cur) ? cur : 0;
          return curVal + 1;
        });
      }

      // บันทึกเวลาเริ่มต้นตรวจ
      await update(ref(db, 'queue/global'), {
        currentStartTime: Date.now()
      });
    } finally {
      setBusy(false);
    }
  };

  const stepBack = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const curRef = ref(db, 'queue/global/currentNumber');
      await runTransaction(curRef, (cur) => {
        const curVal = Number.isFinite(cur) ? cur : 0;
        return Math.max(0, curVal - 1);
      });
    } finally {
      setBusy(false);
    }
  };

  const resetQueue = async () => {
    if (!resetConfirm) {
      setResetConfirm(true);
      setTimeout(() => setResetConfirm(false), 8000);
      return;
    }

    if (busy) return;
    setBusy(true);
    try {
      await update(ref(db, 'queue/global'), {
        currentNumber: 0,
        nextNumber: 1,
      });
      setResetConfirm(false);
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

  if (!isAuthorized) {
    return (
      <div className="min-h-[80vh] grid content-center px-4">
        <div className="text-center mb-10 relative">
          <a 
            href="/patient"
            className="absolute -top-16 left-0 px-4 py-2 text-pink-600 hover:text-pink-700
              flex items-center gap-2 rounded-xl hover:bg-pink-50 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>กลับหน้าผู้ป่วย</span>
          </a>
          <h2 className="text-2xl sm:text-3xl font-bold text-pink-800 mb-2">หน้าสำหรับพยาบาล</h2>
          <p className="text-pink-600">กรุณาใส่รหัสผ่านเพื่อเข้าใช้งาน</p>
        </div>
        <PinPad onSuccess={handleLogin} />
      </div>
    );
  }

  return (
    <div className="min-h-[100vh] bg-gradient-to-b from-pink-50 via-white to-pink-50 grid content-start pb-24 sm:pb-20 pt-4">
      <div className="max-w-4xl mx-auto w-full px-3 sm:px-6">
        <div className="rounded-3xl border-2 border-pink-100 bg-white p-6 sm:p-8 shadow-xl">
          <div className="flex flex-wrap gap-4 items-center justify-between mb-6">
            <div className="flex flex-wrap items-center gap-3">
              <a 
                href="/patient"
                className="px-4 py-2.5 text-sm rounded-xl border-2 border-pink-200 
                  bg-gradient-to-br from-white to-pink-50 hover:to-pink-100 text-pink-600
                  transition-all duration-200 hover:scale-105 hover:shadow-md
                  flex items-center gap-2 font-medium"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                กลับหน้าผู้ป่วย
              </a>
              <h2 className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-pink-500">
                ระบบจัดการคิว
              </h2>
            </div>
            <button 
              onClick={handleLogout}
              className="px-4 py-2.5 text-sm rounded-xl border-2 border-pink-200 
                bg-gradient-to-br from-white to-pink-50 hover:to-pink-100 text-pink-600
                transition-all duration-200 hover:scale-105 hover:shadow-md
                flex items-center gap-2 font-medium"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              ออกจากระบบ
            </button>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <InfoCard 
              label={
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                  </svg>
                  <span>กำลังเรียกคิวที่</span>
                </div>
              } 
              value={currentNumber} 
              highlight 
            />
            <InfoCard 
              label={
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span>คิวที่รออยู่</span>
                </div>
              } 
              value={queueLength}
            />
            <InfoCard 
              label={
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>สถานะระบบ</span>
                </div>
              } 
              value={
                !isConnected ? '🔴 ขาดการเชื่อมต่อ' : 
                busy ? '🟡 กำลังทำงาน...' : 
                '🟢 พร้อมใช้งาน'
              } 
              highlight={isConnected && !busy}
            />
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <button
              onClick={callNext}
              disabled={busy || !hasWaitingQueue}
              className={`
                sm:col-span-2 w-full text-xl sm:text-2xl font-bold 
                rounded-3xl px-6 py-6 
                bg-gradient-to-r from-pink-600 to-pink-500 text-white
                hover:from-pink-500 hover:to-pink-600
                disabled:from-pink-300 disabled:to-pink-300
                focus:outline-none focus:ring-4 focus:ring-pink-200
                transform transition-all duration-200 hover:scale-[1.02]
                shadow-lg hover:shadow-xl disabled:hover:scale-100
                disabled:cursor-not-allowed
                relative overflow-hidden group
              `}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {busy ? (
                  <>
                    <svg className="w-6 h-6 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    กำลังทำงาน...
                  </>
                ) : !hasWaitingQueue ? (
                  <>
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    ไม่มีคิวที่รออยู่
                  </>
                ) : (
                  <>
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    เรียกคิวถัดไป
                  </>
                )}
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </button>
            <button
              onClick={stepBack}
              disabled={busy}
              className={`
                w-full text-lg font-semibold rounded-3xl px-6 py-6
                text-pink-700 bg-gradient-to-br from-pink-50 to-white
                hover:from-pink-100 hover:to-pink-50
                disabled:from-pink-50 disabled:to-pink-50
                border-2 border-pink-200
                focus:outline-none focus:ring-4 focus:ring-pink-100
                transform transition-all duration-200 hover:scale-[1.02]
                disabled:cursor-not-allowed
                shadow-lg hover:shadow-xl
                flex items-center justify-center gap-2
              `}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              ย้อนกลับ 1 คิว
            </button>
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <button
              onClick={resetQueue}
              disabled={busy}
              className={`
                w-full text-lg font-semibold rounded-3xl px-6 py-6
                focus:outline-none focus:ring-4 transition-all duration-200
                transform hover:scale-[1.02] shadow-lg hover:shadow-xl
                flex items-center justify-center gap-2 relative overflow-hidden group
                ${resetConfirm
                  ? 'bg-gradient-to-r from-rose-600 to-rose-500 text-white hover:from-rose-500 hover:to-rose-600 focus:ring-rose-200'
                  : 'text-pink-700 bg-gradient-to-br from-pink-50 to-white hover:from-pink-100 hover:to-pink-50 border-2 border-pink-200 focus:ring-pink-100'
                } ${busy ? 'opacity-60 cursor-not-allowed hover:scale-100' : ''}`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {resetConfirm ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                )}
              </svg>
              {resetConfirm ? 'กดอีกครั้งเพื่อยืนยันรีเซ็ตทั้งหมด' : 'รีเซ็ตระบบคิวทั้งหมด'}
              <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </button>

            <div className="rounded-3xl border-2 border-pink-100 p-6 bg-gradient-to-br from-pink-50/80 to-white backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-pink-700 to-pink-500">
                  การรีเซ็ตระบบ
                </div>
              </div>
              <div className="text-pink-600 text-sm space-y-2">
                <p className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-400 flex-shrink-0" />
                  กำลังเรียก จะกลับไปที่ 0
                </p>
                <p className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-400 flex-shrink-0" />
                  คิวถัดไป จะกลับไปที่ 1
                </p>
                <p className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-400 flex-shrink-0" />
                  ทุกอุปกรณ์จะถูกรีเซ็ตพร้อมกัน
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}