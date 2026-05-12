import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  Table, 
  TableRow, 
  TableCell, 
  WidthType, 
  AlignmentType, 
  HeadingLevel, 
  BorderStyle, 
  VerticalAlign,
  ImageRun
} from "docx";
import { ExamData } from "./geminiService";

async function fetchImageAsBase64(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  return await response.arrayBuffer();
}

async function parseContent(text: string): Promise<(TextRun | ImageRun)[]> {
  const result: (TextRun | ImageRun)[] = [];
  
  // Split by images and math
  // Regex to match [Gambar: ...] or $...$ or $$...$$ or \(...\) or \[...\]
  const regex = /(\[Gambar:.*?\]|\$\$.*?\$\$|\$.*?\$|\\\(.*?\\\)|\\\[.*?\\\])/g;
  const parts = text.split(regex);

  for (const part of parts) {
    if (!part) continue;

    if (part.startsWith('[Gambar:') && part.endsWith(']')) {
      const description = part.slice(8, -1).trim();
      const seed = encodeURIComponent(description.slice(0, 20));
      const imageUrl = `https://picsum.photos/seed/${seed}/400/225`;
      
      try {
        const imageBuffer = await fetchImageAsBase64(imageUrl);
        result.push(new ImageRun({
          data: imageBuffer,
          transformation: {
            width: 400,
            height: 225,
          },
          type: "jpg",
        }));
      } catch (e) {
        result.push(new TextRun({ text: `[Gambar: ${description}]`, color: "FF0000" }));
      }
    } else if (
      (part.startsWith('$$') && part.endsWith('$$')) || 
      (part.startsWith('$') && part.endsWith('$')) ||
      (part.startsWith('\\(') && part.endsWith('\\)')) ||
      (part.startsWith('\\[') && part.endsWith('\\]'))
    ) {
      let mathContent = "";
      if (part.startsWith('$$')) mathContent = part.slice(2, -2);
      else if (part.startsWith('$')) mathContent = part.slice(1, -1);
      else if (part.startsWith('\\(')) mathContent = part.slice(2, -2);
      else if (part.startsWith('\\[')) mathContent = part.slice(2, -2);
      
      // Basic LaTeX to UnicodeMath conversion
      // We use TextRun with Cambria Math for maximum compatibility across Word versions
      let unicodeMath = mathContent
        .replace(/\\frac\{(.+?)\}\{(.+?)\}/g, '($1)/($2)')
        .replace(/\\sqrt\[(.+?)\]\{(.+?)\}/g, 'root($1)($2)')
        .replace(/\\sqrt\{(.+?)\}/g, '√($1)')
        .replace(/\\text\{(.+?)\}/g, '$1')
        .replace(/\\cdot/g, '·')
        .replace(/\\times/g, '×')
        .replace(/\\pm/g, '±')
        .replace(/\\alpha/g, 'α')
        .replace(/\\beta/g, 'β')
        .replace(/\\gamma/g, 'γ')
        .replace(/\\delta/g, 'δ')
        .replace(/\\theta/g, 'θ')
        .replace(/\\pi/g, 'π')
        .replace(/\\sigma/g, 'σ')
        .replace(/\\omega/g, 'ω')
        .replace(/\\infty/g, '∞')
        .replace(/\\neq/g, '≠')
        .replace(/\\leq/g, '≤')
        .replace(/\\geq/g, '≥')
        .replace(/\\approx/g, '≈')
        .replace(/\\rightarrow/g, '→')
        .replace(/\\Rightarrow/g, '⇒')
        .replace(/\\sum/g, '∑')
        .replace(/\\int/g, '∫')
        .replace(/\\log/g, 'log')
        .replace(/\\sin/g, 'sin')
        .replace(/\\cos/g, 'cos')
        .replace(/\\tan/g, 'tan')
        .replace(/\\left\(/g, '(')
        .replace(/\\right\)/g, ')')
        .replace(/\\left\[/g, '[')
        .replace(/\\right\]/g, ']')
        .replace(/\\left\{/g, '{')
        .replace(/\\right\}/g, '}')
        .replace(/\\degree/g, '°')
        .replace(/\\angle/g, '∠')
        .replace(/\\parallel/g, '∥')
        .replace(/\\perp/g, '⊥')
        .replace(/\\triangle/g, '△')
        .replace(/\\square/g, '□')
        .replace(/\\%/g, '%')
        .replace(/\\&/g, '&')
        .replace(/\\#/g, '#')
        .replace(/\\\$/g, '$')
        .replace(/\\\{/g, '{')
        .replace(/\\\}/g, '}')
        .replace(/\\_/g, '_')
        .replace(/\\\^/g, '^')
        .replace(/\{/g, '') // Remove remaining braces
        .replace(/\}/g, '');

      result.push(new TextRun({
        text: unicodeMath,
        italics: true,
        font: "Cambria Math",
      }));
    } else {
      // Check for Arabic text (Quran/Hadith)
      const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
      if (arabicRegex.test(part)) {
        // Split by lines
        const lines = part.split('\n');
        lines.forEach((line, i) => {
          if (arabicRegex.test(line)) {
            // Split line into Arabic and non-Arabic parts
            const lineParts = line.split(/([\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s]+)/g);
            lineParts.forEach(linePart => {
              if (!linePart) return;
              if (arabicRegex.test(linePart)) {
                result.push(new TextRun({
                  text: linePart,
                  rightToLeft: true,
                  font: "Traditional Arabic",
                  size: 28,
                }));
              } else {
                result.push(new TextRun(linePart));
              }
            });
          } else {
            result.push(new TextRun(line));
          }
          if (i < lines.length - 1) {
            result.push(new TextRun({ text: "", break: 1 }));
          }
        });
      } else {
        result.push(new TextRun(part));
      }
    }
  }

  return result;
}

function createMetadataTable(data: ExamData) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Nama Sekolah", bold: true })] })] }),
          new TableCell({ children: [new Paragraph(`: ${data.metadata.schoolName}`)] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Jenjang Pendidikan", bold: true })] })] }),
          new TableCell({ children: [new Paragraph(`: ${data.metadata.jenjangPendidikan}`)] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Kurikulum", bold: true })] })] }),
          new TableCell({ children: [new Paragraph(`: ${data.metadata.curriculum}`)] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Jenis Asesmen", bold: true })] })] }),
          new TableCell({ children: [new Paragraph(`: ${data.metadata.assessmentType}`)] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Tahun Pelajaran", bold: true })] })] }),
          new TableCell({ children: [new Paragraph(`: ${data.metadata.academicYear}`)] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Semester", bold: true })] })] }),
          new TableCell({ children: [new Paragraph(`: ${data.metadata.semester}`)] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Kelas", bold: true })] })] }),
          new TableCell({ children: [new Paragraph(`: ${data.metadata.class}`)] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Fase", bold: true })] })] }),
          new TableCell({ children: [new Paragraph(`: ${data.metadata.phase}`)] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Mata Pelajaran", bold: true })] })] }),
          new TableCell({ children: [new Paragraph(`: ${data.metadata.subject}`)] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Durasi Ujian", bold: true })] })] }),
          new TableCell({ children: [new Paragraph(`: ${data.metadata.duration} Menit`)] }),
        ],
      }),
    ],
  });
}

export async function exportToWord(data: ExamData) {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // Header
          new Paragraph({
            text: data.metadata.schoolName.toUpperCase(),
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            text: `PERANGKAT UJIAN: ${data.metadata.subject.toUpperCase()}`,
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),

          // Metadata Table
          createMetadataTable(data),

          new Paragraph({ text: "", spacing: { before: 200 } }),

          // Kisi-Kisi Section
          new Paragraph({
            text: "KISI-KISI PENULISAN SOAL",
            heading: HeadingLevel.HEADING_2,
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "No", bold: true })], alignment: AlignmentType.CENTER })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "CP/TP", bold: true })], alignment: AlignmentType.CENTER })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Materi", bold: true })], alignment: AlignmentType.CENTER })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Indikator Soal", bold: true })], alignment: AlignmentType.CENTER })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Dimensi Kelulusan", bold: true })], alignment: AlignmentType.CENTER })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Level", bold: true })], alignment: AlignmentType.CENTER })] }),
                ],
              }),
              ...(await Promise.all(data.questions.map(async (q) => 
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ text: q.number.toString(), alignment: AlignmentType.CENTER })] }),
                    new TableCell({ children: [new Paragraph({ children: await parseContent(q.competence) })] }),
                    new TableCell({ children: [new Paragraph({ children: await parseContent(q.materialScope) })] }),
                    new TableCell({ children: [new Paragraph({ children: await parseContent(q.indicator) })] }),
                    new TableCell({ children: [new Paragraph({ children: await parseContent(q.graduationDimension) })] }),
                    new TableCell({ children: [new Paragraph({ text: q.cognitiveLevel.split(' ')[0], alignment: AlignmentType.CENTER })] }),
                  ],
                })
              ))),
            ],
          }),

          new Paragraph({ text: "", spacing: { before: 400 }, pageBreakBefore: true }),

          // Kartu Soal Section (Merged with Key and Discussion)
          new Paragraph({
            text: "KARTU SOAL",
            heading: HeadingLevel.HEADING_2,
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
          createMetadataTable(data),
          new Paragraph({ text: "", spacing: { before: 200 } }),
          ...(await Promise.all(data.questions.map(async (q) => {
            const questionParts = await parseContent(q.questionText);
            const discussionParts = await parseContent(q.discussion);
            const competenceParts = await parseContent(q.competence);
            const materialParts = await parseContent(q.materialScope);
            const indicatorParts = await parseContent(q.indicator);
            const graduationParts = await parseContent(q.graduationDimension);
            
            return new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: `KARTU SOAL NOMOR ${q.number}`, bold: true })] })],
                      columnSpan: 2,
                    }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "CP/TP:", bold: true })] }), new Paragraph({ children: competenceParts })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Level Kognitif:", bold: true })] }), new Paragraph(q.cognitiveLevel)] }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Materi:", bold: true })] }), new Paragraph({ children: materialParts })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Indikator Soal:", bold: true })] }), new Paragraph({ children: indicatorParts })] }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Dimensi Kelulusan:", bold: true })] }), new Paragraph({ children: graduationParts })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Bentuk Soal:", bold: true })] }), new Paragraph(q.type)] }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({
                      children: [
                        new Paragraph({ children: [new TextRun({ text: "Butir Soal:", bold: true })] }),
                        new Paragraph({ children: questionParts }),
                        ...(q.options ? [
                          new Paragraph({ children: [new TextRun({ text: "A. ", bold: true }), ...(await parseContent(q.options.a || ""))] }),
                          new Paragraph({ children: [new TextRun({ text: "B. ", bold: true }), ...(await parseContent(q.options.b || ""))] }),
                          new Paragraph({ children: [new TextRun({ text: "C. ", bold: true }), ...(await parseContent(q.options.c || ""))] }),
                          new Paragraph({ children: [new TextRun({ text: "D. ", bold: true }), ...(await parseContent(q.options.d || ""))] }),
                          ...(q.options.e ? [new Paragraph({ children: [new TextRun({ text: "E. ", bold: true }), ...(await parseContent(q.options.e))] })] : []),
                        ] : []),
                      ],
                      columnSpan: 2,
                    }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({
                      children: [
                        new Paragraph({ children: [new TextRun({ text: "Kunci Jawaban:", bold: true })] }),
                        new Paragraph({ children: await parseContent(q.key.toUpperCase()) }),
                      ],
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({ children: [new TextRun({ text: "Pembahasan:", bold: true })] }),
                        new Paragraph({ children: discussionParts }),
                      ],
                    }),
                  ],
                }),
              ],
            });
          }))).flatMap(table => [table, new Paragraph({ text: "", spacing: { before: 200 } })]),

          new Paragraph({ text: "", spacing: { before: 400 }, pageBreakBefore: true }),

          // Naskah Soal Section
          new Paragraph({
            text: "NASKAH SOAL",
            heading: HeadingLevel.HEADING_2,
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
          ...(await Promise.all(data.questions.map(async (q) => {
            const questionParts = await parseContent(q.questionText);
            const optionAParts = q.options ? await parseContent(q.options.a || "") : [];
            const optionBParts = q.options ? await parseContent(q.options.b || "") : [];
            const optionCParts = q.options ? await parseContent(q.options.c || "") : [];
            const optionDParts = q.options ? await parseContent(q.options.d || "") : [];
            const optionEParts = (q.options && q.options.e) ? await parseContent(q.options.e) : [];

            return [
              new Paragraph({
                children: [
                  new TextRun({ text: `${q.number}. `, bold: true }),
                  ...questionParts,
                ],
                spacing: { before: 200 },
              }),
              ...(q.options ? [
                new Paragraph({ children: [new TextRun({ text: "A. ", bold: true }), ...optionAParts] }),
                new Paragraph({ children: [new TextRun({ text: "B. ", bold: true }), ...optionBParts] }),
                new Paragraph({ children: [new TextRun({ text: "C. ", bold: true }), ...optionCParts] }),
                new Paragraph({ children: [new TextRun({ text: "D. ", bold: true }), ...optionDParts] }),
                ...(q.options.e ? [new Paragraph({ children: [new TextRun({ text: "E. ", bold: true }), ...optionEParts] })] : []),
              ] : []),
            ];
          }))).flat(),

          new Paragraph({ text: "", spacing: { before: 400 }, pageBreakBefore: true }),

          // Pedoman Penskoran Section
          new Paragraph({
            text: "PEDOMAN PENSKORAN",
            heading: HeadingLevel.HEADING_2,
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
          createMetadataTable(data),
          new Paragraph({ text: "", spacing: { before: 200 } }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "No", bold: true })], alignment: AlignmentType.CENTER })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Bentuk", bold: true })], alignment: AlignmentType.CENTER })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Kunci", bold: true })], alignment: AlignmentType.CENTER })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Pedoman Penskoran", bold: true })], alignment: AlignmentType.CENTER })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Skor", bold: true })], alignment: AlignmentType.CENTER })] }),
                ],
              }),
              ...(await Promise.all(data.questions.map(async (q) => 
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ text: q.number.toString(), alignment: AlignmentType.CENTER })] }),
                    new TableCell({ children: [new Paragraph({ text: q.type, alignment: AlignmentType.CENTER })] }),
                    new TableCell({ children: [new Paragraph({ children: await parseContent(q.key.toUpperCase()), alignment: AlignmentType.CENTER })] }),
                    new TableCell({ children: [new Paragraph({ children: await parseContent(q.scoringRubric) })] }),
                    new TableCell({ children: [new Paragraph({ text: q.score.toString(), alignment: AlignmentType.CENTER })] }),
                  ],
                })
              ))),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "TOTAL SKOR MAKSIMAL", bold: true })], alignment: AlignmentType.RIGHT })], columnSpan: 4 }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: data.questions.reduce((sum, q) => sum + q.score, 0).toString(), bold: true })], alignment: AlignmentType.CENTER })] }),
                ],
              }),
            ],
          }),

          new Paragraph({ text: "", spacing: { before: 200 } }),

          // Formula and Distribution
          new Paragraph({
            children: [
              new TextRun({ text: "Rumus Perhitungan Nilai Akhir:", bold: true }),
            ],
            spacing: { before: 200, after: 100 },
          }),
          
          new Table({
            alignment: AlignmentType.CENTER,
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              insideHorizontal: { style: BorderStyle.NONE },
              insideVertical: { style: BorderStyle.NONE },
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ text: "Nilai Akhir =", alignment: AlignmentType.RIGHT })],
                    verticalAlign: VerticalAlign.CENTER,
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: "Skor Perolehan", italics: true })],
                        alignment: AlignmentType.CENTER,
                        border: { bottom: { style: BorderStyle.SINGLE, size: 1 } },
                      }),
                      new Paragraph({
                        children: [new TextRun({ text: "Skor Maksimal", italics: true })],
                        alignment: AlignmentType.CENTER,
                      }),
                    ],
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: "x 100", alignment: AlignmentType.LEFT })],
                    verticalAlign: VerticalAlign.CENTER,
                  }),
                ],
              }),
            ],
          }),

          new Paragraph({
            children: [
              new TextRun({ text: "Sebaran Kunci Jawaban (Pilihan Ganda):", bold: true }),
            ],
            spacing: { before: 200, after: 100 },
          }),
          new Table({
            width: { size: 50, type: WidthType.PERCENTAGE },
            alignment: AlignmentType.CENTER,
            rows: [
              new TableRow({
                children: ['A', 'B', 'C', 'D', 'E'].map(key => 
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: key, bold: true })], alignment: AlignmentType.CENTER })] })
                ),
              }),
              new TableRow({
                children: ['A', 'B', 'C', 'D', 'E'].map(key => {
                  const count = data.questions.filter(q => q.type === 'Pilihan Ganda' && q.key.toUpperCase() === key).length;
                  return new TableCell({ children: [new Paragraph({ text: count.toString(), alignment: AlignmentType.CENTER })] });
                }),
              }),
            ],
          }),

          new Paragraph({ text: "", spacing: { before: 400 } }),
          
          // Signatures
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              insideHorizontal: { style: BorderStyle.NONE },
              insideVertical: { style: BorderStyle.NONE },
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({ text: "Mengetahui,", alignment: AlignmentType.CENTER }),
                      new Paragraph({ text: "Kepala Sekolah", alignment: AlignmentType.CENTER }),
                      new Paragraph({ text: "", spacing: { before: 800 } }),
                      new Paragraph({ text: data.metadata.principalName, alignment: AlignmentType.CENTER, border: { bottom: { style: BorderStyle.SINGLE, size: 1 } } }),
                    ],
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({ text: (data.metadata.city || "Jakarta, " + new Date().toLocaleDateString('id-ID')), alignment: AlignmentType.CENTER }),
                      new Paragraph({ text: "Guru Mata Pelajaran", alignment: AlignmentType.CENTER }),
                      new Paragraph({ text: "", spacing: { before: 800 } }),
                      new Paragraph({ text: data.metadata.teacherName, alignment: AlignmentType.CENTER, border: { bottom: { style: BorderStyle.SINGLE, size: 1 } } }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Perangkat_Ujian_${data.metadata.subject}_Kelas_${data.metadata.class}_${data.metadata.semester}.docx`;
  a.click();
  window.URL.revokeObjectURL(url);
}
