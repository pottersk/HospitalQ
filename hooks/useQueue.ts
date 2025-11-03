'use client';

import { useEffect, useState, useCallback } from 'react';
import { db, ref, onValue, update, push, set, remove } from '@/lib/firebase';
import type { Patient } from '@/types';

export function useQueue() {
  const [patients, setPatients] = useState<Record<string, Patient>>({});
  const [currentPatient, setCurrentPatient] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(true);

  // ดึงข้อมูลผู้ป่วยทั้งหมด (ทั้ง queue และ history)
  useEffect(() => {
    const queueRef = ref(db, 'queue/patients');
    const historyRef = ref(db, 'history/patients');
    
    let queueData: Record<string, Patient> = {};
    let historyData: Record<string, Patient> = {};
    
    const updatePatients = () => {
      setPatients({ ...queueData, ...historyData });
    };
    
    const queueUnsub = onValue(queueRef, (snapshot) => {
      queueData = snapshot.val() || {};
      updatePatients();
      setIsConnected(true);
    }, (error) => {
      console.error('Queue data sync error:', error);
      setIsConnected(false);
    });
    
    const historyUnsub = onValue(historyRef, (snapshot) => {
      historyData = snapshot.val() || {};
      updatePatients();
    });

    const connectedRef = ref(db, '.info/connected');
    const connectedUnsub = onValue(connectedRef, (snap) => {
      setIsConnected(!!snap.val());
    });

    return () => {
      queueUnsub();
      historyUnsub();
      connectedUnsub();
    };
  }, []);

  // ดึงข้อมูลผู้ป่วยปัจจุบัน
  useEffect(() => {
    const currentRef = ref(db, 'queue/current');
    const unsubscribe = onValue(currentRef, (snapshot) => {
      setCurrentPatient(snapshot.val());
    });

    return () => unsubscribe();
  }, []);

  // เพิ่มผู้ป่วยใหม่
  const addPatient = useCallback(async (name: string, hn?: string, doctors?: string[], note?: string): Promise<string> => {
    const patientsRef = ref(db, 'queue/patients');
    const newPatient: Partial<Patient> = {
      id: Date.now(),
      name,
      status: 'waiting',
      timestamp: Date.now()
    };
    
    // เพิ่ม hn เฉพาะเมื่อมีค่า
    if (hn) {
      newPatient.hn = hn;
    }
    
    // เพิ่ม doctors เฉพาะเมื่อมีค่า
    if (doctors && doctors.length > 0) {
      newPatient.doctors = doctors;
    }
    
    // เพิ่ม note เฉพาะเมื่อมีค่า
    if (note) {
      newPatient.note = note;
    }
    
    const newPatientRef = await push(patientsRef, newPatient);
    return newPatientRef.key || '';
  }, []);

  // เรียกผู้ป่วยคนถัดไป
  const callNextPatient = useCallback(async () => {
    // หาผู้ป่วยที่รออยู่คนแรก
    const waitingPatients = Object.entries(patients)
      .filter(([_, p]) => p.status === 'waiting')
      .sort((a, b) => a[1].timestamp - b[1].timestamp);

    if (waitingPatients.length === 0) return;

    const [patientId, patient] = waitingPatients[0];
    
    // อัพเดตสถานะผู้ป่วย
    await update(ref(db, `queue/patients/${patientId}`), {
      status: 'in-progress',
      startTime: Date.now()
    });

    // อัพเดตผู้ป่วยปัจจุบัน
    await set(ref(db, 'queue/current'), patientId);
  }, [patients]);

  // เสร็จสิ้นการตรวจ
  const completeCurrentPatient = useCallback(async () => {
    if (!currentPatient) return;

    const patientData = patients[currentPatient];
    if (!patientData) return;

    // อัปเดตสถานะเป็น completed และบันทึก endTime
    const completedData = {
      ...patientData,
      status: 'completed' as const,
      endTime: Date.now()
    };

    // บันทึกข้อมูลไปที่ history (เพื่อแสดงในตารางว่าเสร็จสิ้น)
    await set(ref(db, `history/patients/${currentPatient}`), completedData);

    // ลบออกจาก queue/patients (ทำให้ link หมดอายุ)
    await remove(ref(db, `queue/patients/${currentPatient}`));

    // ลบผู้ป่วยปัจจุบัน
    await set(ref(db, 'queue/current'), null);
  }, [currentPatient, patients]);

  // ยกเลิกคิว
  const cancelPatient = useCallback(async (patientId: string) => {
    await update(ref(db, `queue/patients/${patientId}`), {
      status: 'cancelled',
      endTime: Date.now()
    });

    if (currentPatient === patientId) {
      await set(ref(db, 'queue/current'), null);
    }
  }, [currentPatient]);

  // ข้ามผู้ป่วยปัจจุบัน
  const skipCurrentPatient = useCallback(async () => {
    if (!currentPatient) return;
    
    // ย้ายผู้ป่วยกลับไปรอ
    await update(ref(db, `queue/patients/${currentPatient}`), {
      status: 'waiting',
      startTime: null
    });

    // ลบผู้ป่วยปัจจุบัน
    await set(ref(db, 'queue/current'), null);
  }, [currentPatient]);

  // แก้ไขข้อมูลผู้ป่วย
  const updatePatient = useCallback(async (patientId: string, name: string, hn?: string, doctors?: string[], note?: string) => {
    const updates: Partial<Patient> = {
      name,
      hn: hn || undefined,
      doctors: doctors && doctors.length > 0 ? doctors : undefined
    };
    
    if (note) {
      updates.note = note;
    }
    
    await update(ref(db, `queue/patients/${patientId}`), updates);
  }, []);

  // ลบผู้ป่วยออกจากระบบ
  const deletePatient = useCallback(async (patientId: string) => {
    // ลบทั้งจาก queue และ history
    await remove(ref(db, `queue/patients/${patientId}`));
    await remove(ref(db, `history/patients/${patientId}`));
    
    if (currentPatient === patientId) {
      await set(ref(db, 'queue/current'), null);
    }
  }, [currentPatient]);

  // จำนวนผู้ป่วยที่รออยู่
  const waitingCount = Object.values(patients).filter(p => p.status === 'waiting').length;

  // ข้อมูลผู้ป่วยปัจจุบัน
  const currentPatientData = currentPatient ? patients[currentPatient] : null;

  // เวลาที่ใช้ในการตรวจปัจจุบัน (ถ้ามี)
  const currentExamTime = currentPatientData?.startTime
    ? Date.now() - currentPatientData.startTime
    : 0;

  // เรียงลำดับผู้ป่วยตามสถานะและเวลา
  const sortedPatients = Object.entries(patients)
    .map(([firebaseId, patient]) => ({
      firebaseId,
      ...patient
    }))
    .sort((a, b) => {
      // เรียงตามสถานะ
      const statusOrder = {
        'in-progress': 0,
        'waiting': 1,
        'completed': 2,
        'cancelled': 3
      };
      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) return statusDiff;
      
      // ถ้าสถานะเดียวกัน เรียงจากเก่าไปใหม่ (ที่มาก่อนขึ้นก่อน)
      return a.timestamp - b.timestamp;
    });

  return {
    patients: sortedPatients,
    currentPatient: currentPatientData,
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
  } as const;
}