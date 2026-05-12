/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Settings, 
  Plus, 
  Trash2, 
  Download, 
  Copy, 
  Check, 
  Loader2, 
  GraduationCap, 
  School, 
  User, 
  BookOpen,
  Layout,
  ClipboardList,
  FileQuestion,
  KeyRound,
  Sparkles,
  Moon,
  Sun,
  Sigma
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import confetti from 'canvas-confetti';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

import { ExamMetadata, ExamData, generateExam } from './services/geminiService';
import { exportToWord } from './services/wordExport';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export default function App() {
  const [metadata, setMetadata] = useState<ExamMetadata>({
    schoolName: '',
    jenjangPendidikan: 'SMA/SMK/MA',
    assessmentType: 'Sumatif Akhir Semester (SAS)',
    semester: 'Ganjil',
    curriculum: 'Kurikulum Merdeka',
    academicYear: '2024/2025',
    subject: '',
    class: '10',
    phase: 'Fase E',
    topic: '',
    questionType: 'Pilihan Ganda',
    lotsPercent: 30,
    motsPercent: 40,
    hotsPercent: 30,
    questionCount: 5,
    duration: 90,
    optionCount: 5,
    displayType: 'Soal teks saja',
    city: '',
    teacherName: '',
    principalName: '',
  });

  const getKelasOptions = (jenjang: string) => {
    switch (jenjang) {
      case 'SD/MI':
        return ['1', '2', '3', '4', '5', '6'];
      case 'SMP/MTs':
        return ['7', '8', '9'];
      case 'SMA/SMK/MA':
        return ['10', '11', '12'];
      default:
        return [];
    }
  };

  const getFaseForKelas = (jenjang: string, kelas: string) => {
    if (jenjang === 'SD/MI') {
      if (['1', '2'].includes(kelas)) return 'Fase A';
      if (['3', '4'].includes(kelas)) return 'Fase B';
      if (['5', '6'].includes(kelas)) return 'Fase C';
    } else if (jenjang === 'SMP/MTs') {
      return 'Fase D';
    } else if (jenjang === 'SMA/SMK/MA') {
      if (kelas === '10') return 'Fase E';
      if (['11', '12'].includes(kelas)) return 'Fase F';
    }
    return '';
  };

  const renderQuestionText = (text: string) => {
    const parts = text.split(/(\[Gambar:.*?\])/g);
    return parts.map((part, index) => {
      if (part.startsWith('[Gambar:') && part.endsWith(']')) {
        const description = part.slice(8, -1).trim();
        const seed = encodeURIComponent(description.slice(0, 20));
        return (
          <div key={index} className="my-4 space-y-2">
            <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 transition-colors">
              <img 
                src={`https://picsum.photos/seed/${seed}/800/450`} 
                alt={description}
                className="h-full w-full object-cover dark:opacity-80 transition-opacity"
                referrerPolicy="no-referrer"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-2 text-[10px] text-white backdrop-blur-sm">
                Ilustrasi AI: {description}
              </div>
            </div>
          </div>
        );
      }
      
      // Check for Arabic text
      const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
      if (arabicRegex.test(part)) {
        return (
          <div key={index} className="inline-block prose prose-slate dark:prose-invert max-w-none w-full">
            <div className="text-right font-serif text-2xl leading-loose mb-4" dir="rtl">
              <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                {part}
              </Markdown>
            </div>
          </div>
        );
      }

      return (
        <div key={index} className="inline-block prose prose-slate dark:prose-invert max-w-none">
          <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
            {part}
          </Markdown>
        </div>
      );
    });
  };

  const [examData, setExamData] = useState<ExamData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasKey, setHasKey] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasKey(true);
    }
  };
  const [activeTab, setActiveTab] = useState<'kisi' | 'kartu' | 'naskah' | 'skor'>('kisi');
  const [copied, setCopied] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    setMetadata(prev => {
      const newMetadata = {
        ...prev,
        [name]: name.includes('Percent') || name === 'questionCount' ? parseInt(value) || 0 : value
      };

      // Handle dynamic logic for class and phase
      if (name === 'jenjangPendidikan') {
        const kelasOptions = getKelasOptions(value);
        newMetadata.class = kelasOptions[0] || '';
        newMetadata.phase = getFaseForKelas(value, newMetadata.class);
      } else if (name === 'class') {
        newMetadata.phase = getFaseForKelas(prev.jenjangPendidikan, value);
      }

      return newMetadata;
    });
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const data = await generateExam(metadata);
      setExamData(data);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (error) {
      console.error("Failed to generate exam:", error);
      alert("Terjadi kesalahan saat membuat soal. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!examData) return;
    const text = JSON.stringify(examData, null, 2);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = async () => {
    if (!examData) return;
    await exportToWord(examData);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-slate-950 pb-20 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              EduMHI <span className="text-indigo-600">Pro</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-4 text-sm font-medium text-slate-500 dark:text-slate-400">
              <span>Generator Perangkat Ujian AI</span>
            </div>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              aria-label="Toggle Dark Mode"
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!hasKey && (
          <div className="mb-8 p-6 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-amber-100 p-2 rounded-full">
                <Sparkles className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h4 className="font-bold text-amber-900">API Key Diperlukan</h4>
                <p className="text-sm text-amber-700">Untuk menggunakan fitur AI di link shared, Anda perlu memilih API Key Anda sendiri.</p>
              </div>
            </div>
            <button 
              onClick={handleSelectKey}
              className="px-6 py-2 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 transition-colors whitespace-nowrap"
            >
              Pilih API Key
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                   {/* Form Sidebar */}
          <div className="lg:col-span-4">
            <form onSubmit={handleGenerate} className="space-y-6">
              {/* Section 1: Identitas Administrasi */}
              <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4 transition-colors">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800 mb-2">
                  <User className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-bold text-slate-800 dark:text-white">Identitas Administrasi</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-text">Jenjang Pendidikan</label>
                    <select 
                      name="jenjangPendidikan"
                      value={metadata.jenjangPendidikan}
                      onChange={handleInputChange}
                      className="input-field"
                      required
                    >
                      <option value="SD/MI">SD/MI</option>
                      <option value="SMP/MTs">SMP/MTs</option>
                      <option value="SMA/SMK/MA">SMA/SMK/MA</option>
                    </select>
                  </div>
                  <div>
                    <label className="label-text">Nama Sekolah</label>
                    <input 
                      name="schoolName"
                      value={metadata.schoolName}
                      onChange={handleInputChange}
                      placeholder="Nama Sekolah"
                      className="input-field"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-text">Jenis Asesmen</label>
                    <select 
                      name="assessmentType"
                      value={metadata.assessmentType}
                      onChange={handleInputChange}
                      className="input-field"
                      required
                    >
                      <option value="Formatif (Harian)">Formatif (Harian)</option>
                      <option value="Asesmen Nasional (AN)">Asesmen Nasional (AN)</option>
                      <option value="Sumatif Akhir Semester (SAS)">Sumatif Akhir Semester (SAS)</option>
                      <option value="Sumatif Tengah Semester (STS)">Sumatif Tengah Semester (STS)</option>
                      <option value="Ujian Sekolah (US)">Ujian Sekolah (US)</option>
                      <option value="Penilaian Sumatif Akhir Jenjang (PSAJ)">Penilaian Sumatif Akhir Jenjang (PSAJ)</option>
                    </select>
                  </div>
                  <div>
                    <label className="label-text">Tahun Pelajaran</label>
                    <select 
                      name="academicYear"
                      value={metadata.academicYear}
                      onChange={handleInputChange}
                      className="input-field"
                      required
                    >
                      <option value="2023/2024">2023/2024</option>
                      <option value="2024/2025">2024/2025</option>
                      <option value="2025/2026">2025/2026</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label-text">Kota [Tanggal TTD]</label>
                  <input 
                    name="city"
                    value={metadata.city}
                    onChange={handleInputChange}
                    placeholder="Contoh: Jakarta, 23 Februari 2026"
                    className="input-field"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-text">Nama guru Mapel</label>
                    <input 
                      name="teacherName"
                      value={metadata.teacherName}
                      onChange={handleInputChange}
                      placeholder="Nama Guru"
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label className="label-text">Kepala Sekolah</label>
                    <input 
                      name="principalName"
                      value={metadata.principalName}
                      onChange={handleInputChange}
                      placeholder="Nama Kepsek"
                      className="input-field"
                      required
                    />
                  </div>
                </div>
              </section>

              {/* Section 2: Kurikulum & Materi */}
              <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4 transition-colors">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800 mb-2">
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-bold text-slate-800 dark:text-white">Kurikulum & Materi</h3>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-text">Kurikulum</label>
                    <select 
                      name="curriculum"
                      value={metadata.curriculum}
                      onChange={handleInputChange}
                      className="input-field"
                      required
                    >
                      <option value="Kurikulum Merdeka">Kurikulum Merdeka</option>
                      <option value="Kurikulum 2013 Revisi">Kurikulum 2013 Revisi</option>
                    </select>
                  </div>
                  <div>
                    <label className="label-text">Mata Pelajaran</label>
                    <input 
                      name="subject"
                      value={metadata.subject}
                      onChange={handleInputChange}
                      placeholder="Matematika"
                      className="input-field"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-text">Kelas</label>
                    <select 
                      name="class"
                      value={metadata.class}
                      onChange={handleInputChange}
                      className="input-field"
                      required
                    >
                      {getKelasOptions(metadata.jenjangPendidikan).map(k => (
                        <option key={k} value={k}>Kelas {k}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label-text">Fase</label>
                    <input 
                      name="phase"
                      value={metadata.phase}
                      readOnly
                      className="input-field bg-slate-50 dark:bg-slate-800/50 cursor-not-allowed"
                      placeholder="Fase"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-text">Semester</label>
                    <select 
                      name="semester"
                      value={metadata.semester}
                      onChange={handleInputChange}
                      className="input-field"
                      required
                    >
                      <option value="Ganjil">Ganjil</option>
                      <option value="Genap">Genap</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label-text">Materi/Topik Utama</label>
                  <textarea 
                    name="topic"
                    value={metadata.topic}
                    onChange={handleInputChange}
                    placeholder="Contoh: Persamaan Kuadrat"
                    className="input-field min-h-[60px] py-2"
                    required
                  />
                </div>

                <div>
                  <label className="label-text">Format Tampilan Soal</label>
                  <select 
                    name="displayType"
                    value={metadata.displayType}
                    onChange={handleInputChange}
                    className="input-field"
                    required
                  >
                    <option value="Soal teks saja">Soal teks saja</option>
                    <option value="Soal bergambar (semua)">Soal bergambar (semua)</option>
                    <option value="Soal Teks dan Bergambar (mix)">Soal Teks dan Bergambar (mix)</option>
                  </select>
                </div>
              </section>

              {/* Section 3: Parameter Asesmen */}
              <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4 transition-colors">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800 mb-2">
                  <ClipboardList className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-bold text-slate-800 dark:text-white">Parameter Asesmen</h3>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-text">Jenis Soal</label>
                    <select 
                      name="questionType"
                      value={metadata.questionType}
                      onChange={handleInputChange}
                      className="input-field"
                      required
                    >
                      <option value="Pilihan Ganda">Pilihan Ganda</option>
                      <option value="Pilihan Ganda Kompleks">Pilihan Ganda Kompleks</option>
                      <option value="Pilihan Ganda + Kompleks">Pilihan Ganda + Kompleks (50:50)</option>
                      <option value="Pilihan Ganda dan Essay (90:10)">Pilihan Ganda dan Essay (90:10)</option>
                      <option value="Pilihan Ganda + Pilihan Ganda Kompleks + Essay (50:40:10)">PG + PG Kompleks + Essay (50:40:10)</option>
                      <option value="Isian Singkat">Isian Singkat</option>
                      <option value="Essay">Essay</option>
                    </select>
                  </div>
                  <div>
                    <label className="label-text">Opsi Jawaban</label>
                    <select 
                      name="optionCount"
                      value={metadata.optionCount}
                      onChange={handleInputChange}
                      className="input-field"
                      required
                    >
                      <option value="3">3 Opsi (A-C) - SD/MI</option>
                      <option value="4">4 Opsi (A-D) - SMP/MTs</option>
                      <option value="5">5 Opsi (A-E) - SMA/SMK/MA</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-text">Jumlah Soal</label>
                    <input 
                      type="number"
                      name="questionCount"
                      value={metadata.questionCount}
                      onChange={handleInputChange}
                      className="input-field"
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="label-text">Durasi (Menit)</label>
                    <input 
                      type="number"
                      name="duration"
                      value={metadata.duration}
                      onChange={handleInputChange}
                      className="input-field"
                      required
                    />
                  </div>
                </div>
              </section>

              {/* Section 4: Distribusi Kesulitan */}
              <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4 transition-colors">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800 mb-2">
                  <Layout className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-bold text-slate-800 dark:text-white">Distribusi Kesulitan</h3>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="label-text text-[10px] uppercase tracking-wider">LOTS (%)</label>
                    <input 
                      type="number"
                      name="lotsPercent"
                      value={metadata.lotsPercent}
                      onChange={handleInputChange}
                      className="input-field text-center"
                    />
                  </div>
                  <div>
                    <label className="label-text text-[10px] uppercase tracking-wider">MOTS (%)</label>
                    <input 
                      type="number"
                      name="motsPercent"
                      value={metadata.motsPercent}
                      onChange={handleInputChange}
                      className="input-field text-center"
                    />
                  </div>
                  <div>
                    <label className="label-text text-[10px] uppercase tracking-wider">HOTS (%)</label>
                    <input 
                      type="number"
                      name="hotsPercent"
                      value={metadata.hotsPercent}
                      onChange={handleInputChange}
                      className="input-field text-center"
                    />
                  </div>
                </div>
              </section>

              <button 
                type="submit" 
                disabled={isLoading}
                className="btn-primary w-full flex items-center justify-center gap-2 py-4 shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all active:scale-[0.98]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    Memproses AI...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-6 h-6" />
                    Generate Soal Ujian
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Output Preview */}
          <div className="lg:col-span-8">
            {!examData && !isLoading ? (
              <div className="h-full min-h-[600px] flex flex-col items-center justify-center bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
                <div className="bg-slate-50 p-6 rounded-full mb-6">
                  <Layout className="w-12 h-12 text-slate-300" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Belum Ada Data</h3>
                <p className="text-slate-500 max-w-sm">
                  Isi formulir di samping dan klik tombol "Generate Soal Ujian" untuk menghasilkan kisi-kisi, kartu soal, dan naskah ujian secara otomatis.
                </p>
              </div>
            ) : isLoading ? (
              <div className="h-full min-h-[600px] flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="bg-indigo-50 p-6 rounded-full mb-6"
                >
                  <Sparkles className="w-12 h-12 text-indigo-600" />
                </motion.div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Sedang Merancang Soal...</h3>
                <p className="text-slate-500 max-w-sm">
                  AI kami sedang menganalisis materi dan menyusun indikator soal HOTS yang berkualitas untuk Anda.
                </p>
              </div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors"
              >
                {/* Tabs */}
                <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                  {[
                    { id: 'kisi', label: 'Kisi-Kisi', icon: ClipboardList },
                    { id: 'kartu', label: 'Kartu Soal', icon: FileText },
                    { id: 'naskah', label: 'Naskah Soal', icon: FileQuestion },
                    { id: 'skor', label: 'Penskoran', icon: Check },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-4 text-sm font-semibold transition-all border-b-2",
                        activeTab === tab.id 
                          ? "border-indigo-600 text-indigo-600 bg-white dark:bg-slate-900" 
                          : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      )}
                    >
                      <tab.icon className="w-4 h-4" />
                      <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                  ))}
                </div>

                {/* Actions */}
                <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Pratinjau Dokumen
                  </span>
                  <div className="flex gap-2">
                    <button 
                      onClick={handleCopy}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      Salin JSON
                    </button>
                    <button 
                      onClick={handleExport}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export ke Word
                    </button>
                  </div>
                </div>

                {/* Content Area */}
                <div className="p-8 max-h-[800px] overflow-y-auto font-serif text-slate-800 dark:text-slate-200 leading-relaxed">
                  <AnimatePresence mode="wait">
                    {activeTab === 'kisi' && (
                      <motion.div 
                        key="kisi"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-6"
                      >
                        <div className="text-center mb-8 space-y-1">
                          <h4 className="text-lg font-bold uppercase">Kisi-Kisi Penulisan Soal</h4>
                          <div className="grid grid-cols-2 gap-x-8 text-left text-xs font-sans max-w-2xl mx-auto pt-4">
                            <p><b>Nama Sekolah:</b> {examData.metadata.schoolName}</p>
                            <p><b>Jenjang Pendidikan:</b> {examData.metadata.jenjangPendidikan}</p>
                            <p><b>Kurikulum:</b> {examData.metadata.curriculum}</p>
                            <p><b>Jenis Asesmen:</b> {examData.metadata.assessmentType}</p>
                            <p><b>Tahun Pelajaran:</b> {examData.metadata.academicYear}</p>
                            <p><b>Semester:</b> {examData.metadata.semester}</p>
                            <p><b>Kelas:</b> {examData.metadata.class}</p>
                            <p><b>Fase:</b> {examData.metadata.phase}</p>
                            <p><b>Mata Pelajaran:</b> {examData.metadata.subject}</p>
                            <p><b>Durasi Ujian:</b> {examData.metadata.duration} Menit</p>
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse border border-slate-300 dark:border-slate-700 text-sm font-sans">
                            <thead className="bg-slate-50 dark:bg-slate-800">
                              <tr>
                                <th className="border border-slate-300 dark:border-slate-700 p-2">No</th>
                                <th className="border border-slate-300 dark:border-slate-700 p-2">CP/TP</th>
                                <th className="border border-slate-300 dark:border-slate-700 p-2">Materi</th>
                                <th className="border border-slate-300 dark:border-slate-700 p-2">Indikator Soal</th>
                                <th className="border border-slate-300 dark:border-slate-700 p-2">Dimensi Kelulusan</th>
                                <th className="border border-slate-300 dark:border-slate-700 p-2">Level</th>
                                <th className="border border-slate-300 dark:border-slate-700 p-2">Bentuk</th>
                              </tr>
                            </thead>
                            <tbody>
                              {examData.questions.map((q) => (
                                <tr key={q.number} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                  <td className="border border-slate-300 dark:border-slate-700 p-2 text-center">{q.number}</td>
                                  <td className="border border-slate-300 dark:border-slate-700 p-2">{q.competence}</td>
                                  <td className="border border-slate-300 dark:border-slate-700 p-2">{q.materialScope}</td>
                                  <td className="border border-slate-300 dark:border-slate-700 p-2">{q.indicator}</td>
                                  <td className="border border-slate-300 dark:border-slate-700 p-2 text-center">{q.graduationDimension}</td>
                                  <td className="border border-slate-300 dark:border-slate-700 p-2 text-center">{q.cognitiveLevel.split(' ')[0]}</td>
                                  <td className="border border-slate-300 dark:border-slate-700 p-2 text-center">{q.type}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </motion.div>
                    )}

                    {activeTab === 'kartu' && (
                      <motion.div 
                        key="kartu"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-8"
                      >
                        <div className="text-center mb-8 space-y-1">
                          <h4 className="text-lg font-bold uppercase">Kartu Soal Ujian</h4>
                          <div className="grid grid-cols-2 gap-x-8 text-left text-xs font-sans max-w-2xl mx-auto pt-4 border-b border-slate-200 pb-6">
                            <p><b>Nama Sekolah:</b> {examData.metadata.schoolName}</p>
                            <p><b>Jenjang Pendidikan:</b> {examData.metadata.jenjangPendidikan}</p>
                            <p><b>Kurikulum:</b> {examData.metadata.curriculum}</p>
                            <p><b>Jenis Asesmen:</b> {examData.metadata.assessmentType}</p>
                            <p><b>Tahun Pelajaran:</b> {examData.metadata.academicYear}</p>
                            <p><b>Semester:</b> {examData.metadata.semester}</p>
                            <p><b>Kelas:</b> {examData.metadata.class}</p>
                            <p><b>Fase:</b> {examData.metadata.phase}</p>
                            <p><b>Mata Pelajaran:</b> {examData.metadata.subject}</p>
                            <p><b>Durasi Ujian:</b> {examData.metadata.duration} Menit</p>
                          </div>
                        </div>
                        {examData.questions.map((q) => (
                          <div key={q.number} className="border-2 border-slate-200 dark:border-slate-800 p-6 rounded-xl space-y-4 font-sans transition-colors">
                            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                              <h4 className="font-bold text-indigo-600 dark:text-indigo-400">KARTU SOAL NOMOR {q.number}</h4>
                              <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded text-xs font-bold uppercase tracking-wider">
                                {q.cognitiveLevel}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px]">CP/TP</p>
                                <p className="dark:text-slate-300">{q.competence}</p>
                              </div>
                              <div>
                                <p className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px]">Lingkup Materi</p>
                                <p className="dark:text-slate-300">{q.materialScope}</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px]">Indikator Soal</p>
                                <p className="dark:text-slate-300">{q.indicator}</p>
                              </div>
                              <div>
                                <p className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px]">Dimensi Kelulusan</p>
                                <p className="dark:text-slate-300">{q.graduationDimension}</p>
                              </div>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-100 dark:border-slate-800 italic transition-colors">
                              <p className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] not-italic mb-2">Butir Soal</p>
                              <div className="font-serif mb-4 dark:text-slate-200">{renderQuestionText(q.questionText)}</div>
                              {q.options && Object.entries(q.options).map(([key, value]) => value && (
                                <div key={key} className="text-sm not-italic ml-4 dark:text-slate-300 flex gap-2">
                                  <span className="font-bold">{key.toUpperCase()}.</span>
                                  <div className="flex-1">{renderQuestionText(value)}</div>
                                </div>
                              ))}
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-100 dark:border-green-900/30 transition-colors">
                                <p className="font-bold text-green-700 dark:text-green-400 uppercase text-[10px] mb-2">Kunci Jawaban</p>
                                <p className="font-bold text-lg dark:text-green-300">{q.key.toUpperCase()}</p>
                              </div>
                              <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg border border-indigo-100 dark:border-indigo-900/30 transition-colors">
                                <p className="font-bold text-indigo-700 dark:text-indigo-400 uppercase text-[10px] mb-2">Pembahasan</p>
                                <div className="text-sm dark:text-indigo-300">{renderQuestionText(q.discussion)}</div>
                              </div>
                            </div>

                            <div className="flex justify-between items-center pt-2">
                              <div className="flex gap-4">
                                <span className="text-xs">Bentuk Soal: <b>{q.type}</b></span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </motion.div>
                    )}

                    {activeTab === 'naskah' && (
                      <motion.div 
                        key="naskah"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-10"
                      >
                        <div className="text-center mb-12 border-b-2 border-double border-slate-300 dark:border-slate-700 pb-6 transition-colors">
                          <h4 className="text-xl font-bold uppercase tracking-tight dark:text-white">{examData.metadata.schoolName}</h4>
                          <p className="text-lg font-medium dark:text-slate-300">UJIAN AKHIR SEMESTER - {examData.metadata.subject}</p>
                          <div className="flex justify-center gap-8 mt-4 text-sm font-sans dark:text-slate-400">
                            <span>Kelas: {examData.metadata.class}</span>
                            <span>Fase: {examData.metadata.phase}</span>
                            <span>Materi: {examData.metadata.topic}</span>
                          </div>
                        </div>

                        <div className="space-y-8">
                          {examData.questions.map((q) => (
                            <div key={q.number} className="space-y-3">
                              <div className="flex gap-3">
                                <span className="font-bold min-w-[24px]">{q.number}.</span>
                                <div className="flex-1">{renderQuestionText(q.questionText)}</div>
                              </div>
                              {q.options && (
                                <div className="pl-9 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm font-sans">
                                  {Object.entries(q.options).map(([key, value]) => value && (
                                    <div key={key} className="flex gap-2">
                                      <span className="font-bold">{key.toUpperCase()}.</span>
                                      <div className="flex-1">{renderQuestionText(value)}</div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {activeTab === 'skor' && (
                      <motion.div 
                        key="skor"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-8"
                      >
                        <div className="text-center mb-8 space-y-1">
                          <h4 className="text-lg font-bold uppercase">Pedoman Penskoran</h4>
                          <div className="grid grid-cols-2 gap-x-8 text-left text-xs font-sans max-w-2xl mx-auto pt-4 border-b border-slate-200 dark:border-slate-800 pb-6 mb-6 transition-colors">
                            <p><b>Nama Sekolah:</b> {examData.metadata.schoolName}</p>
                            <p><b>Jenjang Pendidikan:</b> {examData.metadata.jenjangPendidikan}</p>
                            <p><b>Kurikulum:</b> {examData.metadata.curriculum}</p>
                            <p><b>Jenis Asesmen:</b> {examData.metadata.assessmentType}</p>
                            <p><b>Tahun Pelajaran:</b> {examData.metadata.academicYear}</p>
                            <p><b>Semester:</b> {examData.metadata.semester}</p>
                            <p><b>Kelas:</b> {examData.metadata.class}</p>
                            <p><b>Fase:</b> {examData.metadata.phase}</p>
                            <p><b>Mata Pelajaran:</b> {examData.metadata.subject}</p>
                            <p><b>Durasi Ujian:</b> {examData.metadata.duration} Menit</p>
                          </div>
                          <p className="text-sm text-slate-500 dark:text-slate-400">Kriteria penilaian dan bobot skor per butir soal</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 transition-colors">
                            <p className="font-bold text-indigo-900 dark:text-indigo-100 mb-3 flex items-center gap-2">
                              <Settings className="w-4 h-4" />
                              Rumus Perhitungan Nilai Akhir
                            </p>
                            <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-indigo-100 dark:border-slate-800 text-center">
                              <p className="text-lg font-serif italic dark:text-slate-200">
                                Nilai = <span className="inline-block border-b border-slate-400 dark:border-slate-600 px-2">Skor Perolehan</span> &times; 100
                              </p>
                              <p className="text-sm font-serif italic dark:text-slate-400 mt-1">Skor Maksimal</p>
                            </div>
                            <p className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-3 italic">
                              * Skor Maksimal = {examData.questions.reduce((sum, q) => sum + q.score, 0)}
                            </p>
                          </div>

                          <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 transition-colors">
                            <p className="font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                              <ClipboardList className="w-4 h-4" />
                              Sebaran Kunci Jawaban (PG)
                            </p>
                            <div className="grid grid-cols-5 gap-2">
                              {['A', 'B', 'C', 'D', 'E'].map(key => {
                                const count = examData.questions.filter(q => q.type === 'Pilihan Ganda' && q.key.toUpperCase() === key).length;
                                return (
                                  <div key={key} className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500">{key}</p>
                                    <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{count}</p>
                                  </div>
                                );
                              })}
                            </div>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-3 italic">
                              * Hanya menghitung soal bertipe Pilihan Ganda
                            </p>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse border border-slate-300 dark:border-slate-700 text-sm font-sans">
                            <thead className="bg-slate-50 dark:bg-slate-800">
                              <tr>
                                <th className="border border-slate-300 dark:border-slate-700 p-2 w-16">No</th>
                                <th className="border border-slate-300 dark:border-slate-700 p-2">Bentuk Soal</th>
                                <th className="border border-slate-300 dark:border-slate-700 p-2">Kunci Jawaban</th>
                                <th className="border border-slate-300 dark:border-slate-700 p-2">Kriteria / Pedoman Penskoran</th>
                                <th className="border border-slate-300 dark:border-slate-700 p-2 w-20">Skor</th>
                              </tr>
                            </thead>
                            <tbody>
                              {examData.questions.map((q) => (
                                <tr key={q.number} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                  <td className="border border-slate-300 dark:border-slate-700 p-2 text-center font-bold">{q.number}</td>
                                  <td className="border border-slate-300 dark:border-slate-700 p-2 text-center">{q.type}</td>
                                  <td className="border border-slate-300 dark:border-slate-700 p-2 text-center font-bold text-indigo-600 dark:text-indigo-400">{q.key.toUpperCase()}</td>
                                  <td className="border border-slate-300 dark:border-slate-700 p-2 text-xs whitespace-pre-wrap">{renderQuestionText(q.scoringRubric)}</td>
                                  <td className="border border-slate-300 dark:border-slate-700 p-2 text-center font-bold">{q.score}</td>
                                </tr>
                              ))}
                              <tr className="bg-slate-100 dark:bg-slate-800 font-bold">
                                <td colSpan={4} className="border border-slate-300 dark:border-slate-700 p-2 text-right">TOTAL SKOR MAKSIMAL</td>
                                <td className="border border-slate-300 dark:border-slate-700 p-2 text-center text-indigo-600 dark:text-indigo-400">
                                  {examData.questions.reduce((sum, q) => sum + q.score, 0)}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30 text-xs text-indigo-800 dark:text-indigo-300">
                          <p className="font-bold mb-1">Catatan Perhitungan Nilai Akhir:</p>
                          <p>Nilai Akhir = (Skor Perolehan / Total Skor Maksimal) x 100</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Footer / Signatures */}
                <div className="p-8 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-8 text-center text-sm font-sans transition-colors">
                  <div className="space-y-16">
                    <div>
                      <p className="dark:text-slate-400">Mengetahui,</p>
                      <p className="font-bold dark:text-slate-300">Kepala Sekolah</p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-bold underline uppercase dark:text-white">{examData.metadata.principalName}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-500">NIP. .................................</p>
                    </div>
                  </div>
                  <div className="space-y-16">
                    <div>
                      <p className="dark:text-slate-400">{examData.metadata.city || 'Jakarta, ' + new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                      <p className="font-bold dark:text-slate-300">Guru Mata Pelajaran</p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-bold underline uppercase dark:text-white">{examData.metadata.teacherName}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-500">NIP. .................................</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 border-t border-slate-200 dark:border-slate-800 mt-12 text-center transition-colors">
        <p className="text-slate-400 dark:text-slate-500 text-xs">
          &copy; 2026 EduMHI Pro. Didukung oleh Kecerdasan Buatan untuk Pendidikan Indonesia yang Lebih Baik.
        </p>
      </footer>
    </div>
  );
}
