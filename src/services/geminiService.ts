import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface ExamMetadata {
  schoolName: string;
  jenjangPendidikan: string;
  assessmentType: string;
  semester: string;
  curriculum: string;
  academicYear: string;
  subject: string;
  class: string;
  phase: string;
  topic: string;
  questionType: string;
  lotsPercent: number;
  motsPercent: number;
  hotsPercent: number;
  questionCount: number;
  duration: number;
  optionCount: number;
  displayType: string;
  city: string;
  teacherName: string;
  principalName: string;
}

export interface Question {
  number: number;
  type: string;
  competence: string;
  materialScope: string;
  indicator: string;
  graduationDimension: string;
  cognitiveLevel: "L1 (LOTS)" | "L2 (MOTS)" | "L3 (HOTS)";
  questionText: string;
  options?: {
    a?: string;
    b?: string;
    c?: string;
    d?: string;
    e?: string;
  };
  key: string;
  discussion: string;
  score: number;
  scoringRubric: string;
}

export interface ExamData {
  metadata: ExamMetadata;
  questions: Question[];
}

export async function generateExam(metadata: ExamMetadata): Promise<ExamData> {
  const prompt = `Buatkan perangkat ujian lengkap berdasarkan data berikut:
  Nama Sekolah: ${metadata.schoolName}
  Jenjang Pendidikan: ${metadata.jenjangPendidikan}
  Jenis Asesmen: ${metadata.assessmentType}
  Kurikulum: ${metadata.curriculum}
  Semester: ${metadata.semester}
  Tahun Pelajaran: ${metadata.academicYear}
  Mata Pelajaran: ${metadata.subject}
  Kelas: ${metadata.class}
  Fase: ${metadata.phase}
  Materi Pokok: ${metadata.topic}
  Jenis Soal: ${metadata.questionType}
  Jumlah Soal: ${metadata.questionCount}
  Durasi: ${metadata.duration} menit
  Jumlah Opsi Jawaban: ${metadata.optionCount} (A-${String.fromCharCode(64 + metadata.optionCount)})
  Format Tampilan Soal: ${metadata.displayType}
  Target Kesulitan: LOTS (${metadata.lotsPercent}%), MOTS (${metadata.motsPercent}%), HOTS (${metadata.hotsPercent}%)
  
  Aturan Khusus Jenis Soal:
  - Jika Jenis Soal adalah "Pilihan Ganda dan Essay (90:10)", buatlah soal dengan perbandingan 90% Pilihan Ganda dan 10% Essay.
  - Jika Jenis Soal adalah "Pilihan Ganda + Kompleks", buatlah soal dengan perbandingan 50% Pilihan Ganda dan 50% Pilihan Ganda Kompleks.
  - Jika Jenis Soal adalah "Pilihan Ganda + Pilihan Ganda Kompleks + Essay (50:40:10)", buatlah soal dengan perbandingan 50% Pilihan Ganda, 40% Pilihan Ganda Kompleks, dan 10% Essay.
  - Untuk "Pilihan Ganda Kompleks", kunci jawaban (key) bisa lebih dari satu (misal: "a, c").
  - Untuk "Isian Singkat" dan "Essay", jangan sertakan 'options'.
  
  Hasilkan output dalam format JSON yang berisi array 'questions'. Setiap soal harus memiliki:
  - number: nomor urut
  - type: jenis soal (Pilihan Ganda, Pilihan Ganda Kompleks, Isian Singkat, atau Essay)
  - competence: CP/TP (Capaian Pembelajaran / Tujuan Pembelajaran) (sesuaikan dengan kurikulum ${metadata.curriculum} dan tingkat ${metadata.jenjangPendidikan})
  - materialScope: Lingkup Materi
  - indicator: Indikator Soal (harus spesifik dan mengukur kemampuan berpikir sesuai tingkat ${metadata.jenjangPendidikan})
  - graduationDimension: Pilih satu dari 8 Dimensi Kelulusan Kemendikdasmen yang paling relevan dengan soal ini:
    1. Keimanan dan Ketakwaan terhadap Tuhan YME
    2. Kewargaan
    3. Penalaran Kritis
    4. Kreativitas
    5. Kolaborasi
    6. Kemandirian
    7. Kesehatan
    8. Komunikasi
  - cognitiveLevel: "L1 (LOTS)", "L2 (MOTS)", atau "L3 (HOTS)"
  - questionText: Teks soal (gunakan stimulus jika HOTS, sesuaikan tingkat kesulitan bahasa dengan ${metadata.jenjangPendidikan}). 
    PENTING: Jika Mata Pelajaran adalah Matematika, Fisika, atau Kimia, gunakan format LaTeX untuk rumus atau persamaan matematika/kimia (misal: $x^2 + y^2 = r^2$ atau $\text{H}_2\text{O}$).
    PENTING: Jika Mata Pelajaran berkaitan dengan Pendidikan Agama Islam (PAI), cantumkan teks Arab yang asli (dengan harakat) untuk setiap kutipan ayat Al-Qur'an atau Hadist, diikuti dengan terjemahannya.
    PENTING: Jika Format Tampilan Soal adalah 'Soal bergambar (semua)' atau 'Soal Teks dan Bergambar (mix)', Anda WAJIB menyertakan deskripsi gambar yang sangat spesifik di awal atau di tengah teks soal menggunakan format: [Gambar: deskripsi visual yang detail tentang apa yang harus ada di gambar]. Contoh: [Gambar: Grafik pertumbuhan ekonomi Indonesia tahun 2020-2024].
  - options: (hanya untuk PG/PG Kompleks) objek dengan kunci a, b, c, d, e (sesuaikan jumlah opsi dengan ${metadata.optionCount})
  - key: Kunci jawaban (untuk PG/PG Kompleks: a/b/c/d/e, untuk Isian/Essay: jawaban singkat/poin utama)
  - discussion: Pembahasan mendalam dan logis yang menjelaskan konsep.
  - score: Bobot skor untuk soal ini. PENTING: Pastikan TOTAL SKOR dari seluruh soal (questionCount) berjumlah tepat 100. Jika soal PG, bagi rata (misal 50 soal = 2 poin/soal). Jika campuran, sesuaikan bobotnya (misal Essay lebih besar) namun total tetap 100.
  - scoringRubric: Pedoman penskoran detail (terutama untuk Essay/PG Kompleks).
  
  Pastikan kualitas soal tinggi, bahasa Indonesia yang baku, dan sesuai dengan target persentase tingkat kesulitan.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                number: { type: Type.INTEGER },
                type: { type: Type.STRING },
                competence: { type: Type.STRING },
                materialScope: { type: Type.STRING },
                indicator: { type: Type.STRING },
                graduationDimension: { type: Type.STRING },
                cognitiveLevel: { type: Type.STRING },
                questionText: { type: Type.STRING },
                options: {
                  type: Type.OBJECT,
                  properties: {
                    a: { type: Type.STRING },
                    b: { type: Type.STRING },
                    c: { type: Type.STRING },
                    d: { type: Type.STRING },
                    e: { type: Type.STRING },
                  },
                },
                key: { type: Type.STRING },
                discussion: { type: Type.STRING },
                score: { type: Type.NUMBER },
                scoringRubric: { type: Type.STRING },
              },
              required: ["number", "type", "competence", "materialScope", "indicator", "graduationDimension", "cognitiveLevel", "questionText", "key", "discussion", "score", "scoringRubric"]
            }
          }
        },
        required: ["questions"]
      }
    }
  });

  const result = JSON.parse(response.text || "{}");
  return {
    metadata,
    questions: result.questions
  };
}
