'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { K } from '@/lib/keys';
import { readInt, writeInt } from '@/lib/storage';
import { db, ref, onValue, update } from '@/lib/firebase';

type QueueSnapshot = {
  nextNumber: number;
  currentNumber: number;
  lastUpdate?: number;
  currentStartTime?: number;    // เวลาที่เริ่มตรวจคนปัจจุบัน
  averageTime?: number;         // เวลาเฉลี่ยต่อคน (milliseconds)
  notifiedTickets?: number[];   // คิวที่ได้รับการแจ้งเตือนแล้ว
};

const QPATH = 'queue/global';
const DEFAULT_AVG_TIME = 15 * 60 * 1000; // 15 minutes in milliseconds

const INITIAL_STATE: QueueSnapshot = {
  nextNumber: 1,
  currentNumber: 0,
  lastUpdate: Date.now(),
  currentStartTime: Date.now(),
  averageTime: DEFAULT_AVG_TIME,
  notifiedTickets: [],
};

export function useQueue() {
  const [queueState, setQueueState] = useState<QueueSnapshot>(INITIAL_STATE);
  const [isConnected, setIsConnected] = useState(true);
  const [userTicket, setUserTicket] = useState<number>(0);

  // อ่านค่า ticket จาก localStorage หลัง component mount
  useEffect(() => {
    const savedTicket = readInt(K.userTicket, 0);
    if (savedTicket > 0) {
      setUserTicket(savedTicket);
    }
  }, []);

  useEffect(() => {
    const queueRef = ref(db, QPATH);
    
    // เมื่อมีการรีเซ็ตที่ Firebase ให้เคลียร์ค่าในเครื่องด้วย
    const handleReset = (snapshot: any) => {
      const data = snapshot.val();
      if (data?.currentNumber === 0 && data?.nextNumber === 1) {
        localStorage.removeItem(K.userTicket);
        setUserTicket(0);
      }
    };

    // เช็คค่าเริ่มต้นเพียงครั้งเดียว
    const checkOnce = onValue(queueRef, (snapshot) => {
      if (!snapshot.exists()) {
        // ถ้ายังไม่มีข้อมูล ค่อยสร้างค่าเริ่มต้น
        update(queueRef, {
          ...INITIAL_STATE,
          lastUpdate: Date.now()
        });
      }
      checkOnce(); // unsubscribe ทันที
    }, { onlyOnce: true });

    const unsubscribe = onValue(queueRef, (snapshot) => {
      handleReset(snapshot);
      const data = snapshot.val() as QueueSnapshot;
      
      const validData = {
        nextNumber: Number.isFinite(data?.nextNumber) ? data.nextNumber : INITIAL_STATE.nextNumber,
        currentNumber: Number.isFinite(data?.currentNumber) ? data.currentNumber : INITIAL_STATE.currentNumber,
        lastUpdate: data?.lastUpdate || Date.now(),
      };

      setQueueState(validData);
      setIsConnected(true);
    }, (error) => {
      console.error('Queue data sync error:', error);
      setIsConnected(false);
    });

    const connectedRef = ref(db, '.info/connected');
    const connectedUnsub = onValue(connectedRef, (snap) => {
      setIsConnected(!!snap.val());
    });

    return () => {
      unsubscribe();
      connectedUnsub();
    };
  }, []);

  useEffect(() => {
    if (userTicket > 0) {
      writeInt(K.userTicket, userTicket);
    }
  }, [userTicket]);

  // คำนวณจำนวนคิวที่รออยู่ในระบบ
  const queueLength = useMemo(
    () => Math.max(0, queueState.nextNumber - Math.max(queueState.currentNumber, 0) - 1),
    [queueState.nextNumber, queueState.currentNumber]
  );

  // คำนวณจำนวนคิวที่ต้องรอสำหรับผู้ใช้
  const myWaiting = useMemo(
    () => (userTicket > 0 ? Math.max(0, userTicket - queueState.currentNumber) : 0),
    [userTicket, queueState.currentNumber]
  );

  const hasWaitingQueue = useMemo(
    () => queueState.nextNumber > queueState.currentNumber + 1,
    [queueState.nextNumber, queueState.currentNumber]
  );

  const setNextNumber = useCallback(async (n: number) => {
    const queueRef = ref(db, QPATH);
    return update(queueRef, { 
      nextNumber: n,
      lastUpdate: Date.now()
    });
  }, []);

  // ตรวจสอบว่าคิวถูกยกเลิกหรือไม่
  const checkIfTicketCancelled = useCallback(async (ticketNumber: number) => {
    const cancelledRef = ref(db, `queue/cancelled/${ticketNumber}`);
    return new Promise((resolve) => {
      onValue(cancelledRef, (snapshot) => {
        resolve(snapshot.exists());
      }, { onlyOnce: true });
    });
  }, []);

  const setCurrentNumber = useCallback(async (n: number) => {
    // ตรวจสอบว่าคิวถูกยกเลิกหรือไม่
    const isCancelled = await checkIfTicketCancelled(n);
    if (isCancelled) {
      // ถ้าคิวถูกยกเลิก ให้ข้ามไปคิวถัดไป
      const nextTicket = n + 1;
      console.log(`Ticket ${n} was cancelled, skipping to ${nextTicket}`);
      const queueRef = ref(db, QPATH);
      return update(queueRef, {
        currentNumber: nextTicket,
        lastUpdate: Date.now(),
        currentStartTime: Date.now()
      });
    }

    const queueRef = ref(db, QPATH);
    return update(queueRef, { 
      currentNumber: n,
      lastUpdate: Date.now(),
      currentStartTime: Date.now()
    });
  }, [checkIfTicketCancelled]);

  // คำนวณเวลาที่ใช้ไปในการตรวจคนปัจจุบัน
  const currentExamTime = useMemo(() => {
    if (!queueState.currentStartTime) return 0;
    return Date.now() - queueState.currentStartTime;
  }, [queueState.currentStartTime]);

  // คำนวณเวลาที่คาดว่าจะรอ
  const estimatedWaitTime = useMemo(() => {
    if (myWaiting <= 0) return 0;
    const averageTime = queueState.averageTime || DEFAULT_AVG_TIME;
    return myWaiting * averageTime;
  }, [myWaiting, queueState.averageTime]);

  // ตรวจสอบว่าควรแจ้งเตือนหรือไม่
  useEffect(() => {
    const checkAndNotify = async () => {
      if (!userTicket) return;

      if (myWaiting <= 3 && myWaiting > 0) {
        // แจ้งเตือนเมื่อใกล้ถึงคิว
        const notified = queueState.notifiedTickets?.includes(userTicket);
        if (!notified && 'Notification' in window) {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            new Notification('เตรียมตัวพบแพทย์', {
              body: `อีก ${myWaiting} คิว จะถึงคิวของคุณ`,
              icon: '/icon.png'
            });
            // บันทึกว่าได้แจ้งเตือนคิวนี้แล้ว
            const queueRef = ref(db, QPATH);
            update(queueRef, {
              notifiedTickets: [...(queueState.notifiedTickets || []), userTicket]
            });
          }
        }
      } else if (userTicket === queueState.currentNumber) {
        // แจ้งเตือนเมื่อถึงคิว
        if ('Notification' in window) {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            new Notification('ถึงคิวของคุณแล้ว!', {
              body: 'กรุณาเข้าพบแพทย์ที่ห้องตรวจ',
              icon: '/icon.png',
              requireInteraction: true // การแจ้งเตือนจะไม่หายไปจนกว่าจะกดปิด
            });
          }
        }
      }
    };

    checkAndNotify();
  }, [myWaiting, userTicket, queueState.notifiedTickets]);

  return {
    nextNumber: queueState.nextNumber,
    currentNumber: queueState.currentNumber,
    setNextNumber,
    setCurrentNumber,
    userTicket,
    setUserTicket,
    queueLength,
    myWaiting,
    isConnected,
    hasWaitingQueue,
    currentExamTime,        // เวลาที่ใช้ในการตรวจคนปัจจุบัน
    estimatedWaitTime,     // เวลาที่คาดว่าจะต้องรอ
  } as const;
}
