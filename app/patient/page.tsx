'use client';

import { useState } from 'react';
import { useQueue } from '@/hooks/useQueue';
import { db, ref, runTransaction, update } from '@/lib/firebase';
import { InfoCard } from '@/components/InfoCard';
import { K } from '@/lib/keys';

export default function PatientPage() {
  const {
    currentNumber,
    nextNumber,
    userTicket,
    setUserTicket,
    myWaiting,
    currentExamTime,
    estimatedWaitTime,
  } = useQueue();
  const [busy, setBusy] = useState(false);

  const getTicket = async () => {
    if (busy || userTicket > currentNumber) return;

    setBusy(true);
    try {
      const globalRef = ref(db, 'queue/global');
      let myTicket = 0;

      await runTransaction(globalRef, (current) => {
        if (!current) {
          // ถ้าไม่มีข้อมูล ให้เริ่มที่ 1
          return {
            currentNumber: 0,
            nextNumber: 2,
            currentStartTime: 0
          };
        }

        // หาคิวที่ว่างถัดไป โดยตรวจสอบว่าไม่มีการยกเลิก
        const nextNumber = Number.isFinite(current.nextNumber) ? current.nextNumber : 1;
        myTicket = nextNumber;

        return {
          ...current,
          nextNumber: nextNumber + 1
        };
      });

      if (myTicket > 0) {
        // บันทึกคิวลงใน Firebase เพื่อเก็บประวัติ
        const ticketRef = ref(db, `queue/tickets/${myTicket}`);
        await update(ticketRef, {
          timestamp: Date.now(),
          status: 'waiting'
        });
        
        setUserTicket(myTicket);
      }
    } catch (error) {
      console.error('Error getting ticket:', error);
      alert('ไม่สามารถรับคิวได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setBusy(false);
    }
  };

  const dropTicket = async () => {
    if (busy || !userTicket) return;
    
    if (!confirm('ยืนยันการยกเลิกคิว?')) return;

    setBusy(true);
    try {
      // อัพเดตสถานะการยกเลิกที่ Firebase
      const queueRef = ref(db, `queue/cancelled/${userTicket}`);
      await update(queueRef, {
        timestamp: Date.now(),
        previousStatus: 'cancelled_by_user'
      });

      // อัพเดต nextNumber ถ้าเป็นคิวสุดท้าย
      const globalRef = ref(db, 'queue/global');
      await runTransaction(globalRef, (current) => {
        if (!current) return current;
        
        // ถ้าคิวที่ยกเลิกเป็นคิวสุดท้าย ให้ลด nextNumber ลง
        if (current.nextNumber === userTicket + 1) {
          return {
            ...current,
            nextNumber: userTicket // ให้คิวถัดไปเป็นคิวที่ยกเลิกไป
          };
        }
        return current;
      });

      // ลบข้อมูลในเครื่อง
      localStorage.removeItem(K.userTicket);
      setUserTicket(0);

      alert('ยกเลิกคิวเรียบร้อย');
    } catch (error) {
      console.error('Error dropping ticket:', error);
      alert('ไม่สามารถยกเลิกคิวได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[100vh] bg-gradient-to-b from-pink-50 via-white to-pink-50">
      <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 grid gap-6">
        {/* Header Section */}
        <div className="rounded-3xl border-2 border-pink-100 bg-white p-6 shadow-xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-pink-500 text-center mb-2">
            ระบบคิวผู้ป่วย
          </h2>
          <p className="text-pink-600 text-center text-sm sm:text-base">
            คลินิกโรคหัวใจและหลอดเลือด
          </p>
          <div className="mt-2 flex justify-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-50 border border-pink-200">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-medium text-pink-600">เปิดให้บริการ</span>
            </div>
          </div>
        </div>

        {/* Current Number Section */}
        <div className="rounded-3xl border-2 border-pink-200 bg-gradient-to-br from-pink-50 to-white p-6 shadow-xl">
          <div className="text-center">
            <div className="text-sm font-medium text-pink-600 mb-2 flex items-center justify-center gap-2">
              <svg className="w-5 h-5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
              กำลังเรียกคิวที่
            </div>
            <div className="text-5xl sm:text-6xl font-bold text-pink-600 mb-2">
              {currentNumber}
            </div>
            {currentExamTime > 0 && (
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-pink-100/50 border border-pink-200">
                <svg className="w-4 h-4 text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span suppressHydrationWarning className="text-sm font-medium text-pink-600">
                  เวลาตรวจ: {Math.floor(currentExamTime / 60000)} นาที
                </span>
              </div>
            )}
          </div>
        </div>

        {/* User's Queue Info Section */}
        <div className="rounded-3xl border-2 border-pink-100 bg-white p-6 shadow-xl">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 rounded-2xl bg-gradient-to-br from-pink-50 to-white border-2 border-pink-200">
              <div className="text-sm font-medium text-pink-600 mb-1">คิวของคุณ</div>
              <div className="text-3xl font-bold text-pink-600">
                {userTicket === 0 ? '-' : userTicket}
              </div>
            </div>
            <div className="text-center p-4 rounded-2xl bg-gradient-to-br from-pink-50 to-white border-2 border-pink-100">
              <div className="text-sm font-medium text-pink-600 mb-1">คิวถัดไป</div>
              <div className="text-3xl font-bold text-pink-700">
                {Math.max(currentNumber + 1, 1)}
              </div>
            </div>
          </div>

          {userTicket > 0 && (
            <div className="mt-3 space-y-3">
              <div className={`
                rounded-2xl p-4 border-2 relative overflow-hidden
                ${userTicket === currentNumber 
                  ? 'border-green-200 bg-gradient-to-br from-green-50 to-white'
                  : myWaiting <= 3
                    ? 'border-orange-200 bg-gradient-to-br from-orange-50 to-white'
                    : 'border-yellow-200 bg-gradient-to-br from-yellow-50 to-white'
                }
              `}>
                <div className="flex items-center gap-2">
                  <div className={`
                    w-2 h-2 rounded-full
                    ${userTicket === currentNumber 
                      ? 'bg-green-500 animate-pulse' 
                      : myWaiting <= 3
                        ? 'bg-orange-500 animate-pulse'
                        : 'bg-yellow-500'
                    }
                  `} />
                  <div className={`
                    text-sm font-semibold
                    ${userTicket === currentNumber 
                      ? 'text-green-700' 
                      : myWaiting <= 3
                        ? 'text-orange-700'
                        : 'text-yellow-700'
                    }
                  `}>
                    สถานะคิว
                  </div>
                </div>
                <div className="space-y-1">
                  <div className={`
                    text-lg sm:text-xl font-bold
                    ${userTicket === currentNumber 
                      ? 'text-green-600' 
                      : myWaiting <= 3
                        ? 'text-orange-600'
                        : 'text-yellow-600'
                    }
                  `}>
                    {userTicket === currentNumber ? (
                      'ถึงคิวเรียกตรวจแล้ว!'
                    ) : myWaiting > 0 ? (
                      <>ยังไม่ถึงคิว: รออีก {myWaiting} คิว</>
                    ) : (
                      'รอเรียกตรวจ'
                    )}
                  </div>
                  {userTicket === currentNumber && (
                    <div className="flex items-center gap-2 text-sm text-green-600 animate-pulse">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                        />
                      </svg>
                      <span className="font-medium">กรุณาเข้าพบแพทย์ที่ห้องตรวจ</span>
                    </div>
                  )}
                </div>
                {myWaiting > 0 && myWaiting <= 3 && (
                  <div className="absolute top-2 right-2 animate-bounce">
                    <svg className="w-6 h-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" 
                      />
                    </svg>
                  </div>
                )}
              </div>

              {estimatedWaitTime > 0 && (
                <div className="rounded-2xl p-4 border-2 border-pink-100 bg-gradient-to-br from-pink-50/50 to-white">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-5 h-5 text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
                      />
                    </svg>
                    <div className="text-sm font-semibold text-pink-700">เวลารอโดยประมาณ</div>
                  </div>
                  <div suppressHydrationWarning className="text-pink-600">
                    {estimatedWaitTime < 3600000 ? (
                      `ประมาณ ${Math.ceil(estimatedWaitTime / 60000)} นาที`
                    ) : (
                      `ประมาณ ${Math.floor(estimatedWaitTime / 3600000)} ชั่วโมง ${Math.ceil((estimatedWaitTime % 3600000) / 60000)} นาที`
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-lg border-t border-pink-100">
          <div className="max-w-2xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={getTicket}
              disabled={busy || userTicket > currentNumber}
              className={`
                sm:col-span-2 w-full text-lg font-bold
                rounded-2xl px-4 py-4 bg-gradient-to-r from-pink-600 to-pink-500 text-white 
                hover:from-pink-500 hover:to-pink-600 disabled:from-pink-300 disabled:to-pink-300
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
                    <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    กำลังรับคิว...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    รับคิวใหม่
                  </>
                )}
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </button>
            {userTicket > 0 && (
              <button
                onClick={dropTicket}
                disabled={busy}
                className={`
                  w-full text-base font-semibold rounded-2xl px-4 py-4
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
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                ยกเลิกคิว
              </button>
            )}
          </div>
        </div>

        {/* Info Cards Section */}
        <div className="grid sm:grid-cols-2 gap-4">
          {/* Room Info */}
          <div className="rounded-3xl border-2 border-pink-100 bg-gradient-to-br from-pink-50/30 to-white p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-pink-100 text-pink-600 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-700 to-pink-500">
                  ห้องตรวจโรคหัวใจ
                </h3>
                <div className="text-pink-600 text-sm">Cardiology Clinic</div>
              </div>
            </div>
            <div className="text-sm text-pink-600 space-y-2">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>เวลาตรวจ: 08:00 - 16:00 น.</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>-</span>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="rounded-3xl border-2 border-pink-100 bg-gradient-to-br from-pink-50/30 to-white p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-pink-100 text-pink-600 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-700 to-pink-500">
                  ขั้นตอนการใช้งาน
                </h3>
              </div>
            </div>
            <ul className="space-y-3">
              <li className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-lg bg-pink-50 border border-pink-200 text-pink-600 
                  flex-shrink-0 flex items-center justify-center font-bold text-xs">
                  1
                </div>
                <div className="flex-1 text-sm text-pink-600">
                  <div className="font-medium">กดรับคิวใหม่</div>
                  <div className="text-pink-500 text-xs mt-0.5">ระบบจะบันทึกคิวในอุปกรณ์นี้</div>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-lg bg-pink-50 border border-pink-200 text-pink-600 
                  flex-shrink-0 flex items-center justify-center font-bold text-xs">
                  2
                </div>
                <div className="flex-1 text-sm text-pink-600">
                  <div className="font-medium">รอเรียกตามลำดับ</div>
                  <div className="text-pink-500 text-xs mt-0.5">อัพเดทแบบเรียลไทม์</div>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}