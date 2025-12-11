'use client';

import { useState } from 'react';
import { Container, Text, Paper, Group, Stack, RingProgress, Center, Button, rem, Transition } from '@mantine/core';
import { useHover } from '@mantine/hooks';
import { IconUpload, IconFileTypePdf, IconCheck, IconX, IconBriefcase } from '@tabler/icons-react';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

export default function Home() {
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [processedFileName, setProcessedFileName] = useState('');
  const { hovered, ref: hoverRef } = useHover();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const processPdfOnClient = async (file: File) => {
    setStatus('processing');
    setMessage('페이지 번호 매기는 중...');

    try {
      // 1. Read PDF file
      const fileBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(fileBuffer);

      // 2. Load Font
      pdfDoc.registerFontkit(fontkit);
      const fontBytes = await fetch('/fonts/KoPubWorldDotumLight.ttf').then((res) => {
        if (!res.ok) throw new Error('폰트 파일을 불러오지 못했습니다.');
        return res.arrayBuffer();
      });
      const customFont = await pdfDoc.embedFont(fontBytes);

      // 3. Process Pages
      const pages = pdfDoc.getPages();
      const fontSize = 10;

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const { width, height } = page.getSize();
        const rotation = page.getRotation().angle; // Get rotation angle (0, 90, 180, 270)
        const text = `- ${i + 1} -`;
        const textWidth = customFont.widthOfTextAtSize(text, fontSize);

        let x = 0;
        let y = 0;

        // Calculate position based on rotation
        // Goal: Always place at bottom center of the visual page
        switch (rotation) {
          case 0: // Normal orientation
            x = (width / 2) - (textWidth / 2);
            y = 30;
            break;
          case 90: // Rotated 90° clockwise
            x = width - 30;
            y = (height / 2) - (fontSize / 2);
            break;
          case 180: // Rotated 180° (upside down)
            x = (width / 2) - (textWidth / 2);
            y = height - 30 - fontSize;
            break;
          case 270: // Rotated 270° clockwise (or 90° counter-clockwise)
            x = 30;
            y = (height / 2) - (fontSize / 2);
            break;
          default:
            x = (width / 2) - (textWidth / 2);
            y = 30;
        }

        page.drawText(text, {
          x: x,
          y: y,
          size: fontSize,
          font: customFont,
          color: rgb(0, 0, 0),
        });
      }

      // 4. Save and Download
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const originalName = file.name.replace(/\.pdf$/i, '');
      const newFileName = `${originalName}_numbered.pdf`;

      const link = document.createElement('a');
      link.href = url;
      link.download = newFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setStatus('success');
      setMessage('다운로드 완료!');
      setProcessedFileName(newFileName);

    } catch (err) {
      console.error(err);
      setStatus('error');
      setMessage('처리 중 오류가 발생했습니다.');
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        await processPdfOnClient(file);
      } else {
        setStatus('error');
        setMessage('PDF 파일을 업로드해주세요.');
      }
    }
  };

  const handleManualSelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf';
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        await processPdfOnClient(files[0]);
      }
    };
    input.click();
  };

  return (
    <div className="h-screen w-screen flex flex-col justify-center items-center p-8 draggable-region bg-gray-50/50">
      <Container size="xs" className="w-full">
        <Stack gap="xl">
          <div className="text-center">
            <h1 className="text-3xl font-light text-gray-800 tracking-tight mb-2">PDF 페이지 번호 매기기</h1>
            <Text c="dimmed" size="sm">웹 브라우저에서 안전하게 변환하세요 (서버 전송 X)</Text>
          </div>

          <Paper
            ref={hoverRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            radius="xl"
            withBorder
            className={`
              relative overflow-hidden transition-all duration-300 ease-out flex flex-col items-center justify-center
              h-80 border-2 border-dashed
              ${isDragging || hovered ? 'border-blue-400 bg-blue-50/50 scale-[1.02]' : 'border-gray-300 bg-white/40'}
              ${status === 'processing' ? 'cursor-wait' : 'cursor-pointer'}
            `}
            onClick={() => status !== 'processing' && handleManualSelect()}
          >
            <Transition mounted={status === 'idle'} transition="fade" duration={200} timingFunction="ease">
              {(styles) => (
                <Stack style={styles} align="center" gap="md" className="pointer-events-none">
                  <div className={`p-4 rounded-full bg-gray-100/80 transition-transform duration-300 ${hovered || isDragging ? 'scale-110' : ''}`}>
                    <IconFileTypePdf size={48} className="text-gray-500" stroke={1.5} />
                  </div>
                  <div className="text-center">
                    <Text size="lg" fw={500} c="dark">PDF를 여기로 드래그하세요</Text>
                    <Text size="sm" c="dimmed" mt={4}>또는 클릭하여 파일 선택</Text>
                  </div>
                </Stack>
              )}
            </Transition>

            <Transition mounted={status === 'processing'} transition="fade" duration={200} timingFunction="ease">
              {(styles) => (
                <div style={styles} className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm z-10">
                  <RingProgress
                    sections={[{ value: 100, color: 'blue' }]}
                    label={
                      <Center>
                        <IconUpload size={22} className="animate-bounce text-blue-500" />
                      </Center>
                    }
                  />
                  <Text size="sm" fw={500} mt="md" className="animate-pulse">{message}</Text>
                </div>
              )}
            </Transition>

            <Transition mounted={status === 'success'} transition="scale-y" duration={300} timingFunction="ease">
              {(styles) => (
                <div style={styles} className="absolute inset-0 flex flex-col items-center justify-center bg-green-50/95 backdrop-blur-sm z-20">
                  <div className="p-4 rounded-full bg-green-100 text-green-600 mb-4 animate-in zoom-in spin-in-3">
                    <IconCheck size={40} stroke={3} />
                  </div>
                  <Text size="lg" fw={600} c="green.9">{message}</Text>
                  <Text size="sm" c="dimmed" mt={1}>{processedFileName}</Text>
                  <Button
                    variant="light"
                    color="green"
                    radius="xl"
                    mt="lg"
                    onClick={(e) => {
                      e.stopPropagation();
                      setStatus('idle');
                    }}
                  >
                    다른 파일 변환하기
                  </Button>
                </div>
              )}
            </Transition>

            <Transition mounted={status === 'error'} transition="pop" duration={300} timingFunction="ease">
              {(styles) => (
                <div style={styles} className="absolute inset-0 flex flex-col items-center justify-center bg-red-50/95 backdrop-blur-sm z-20">
                  <div className="p-4 rounded-full bg-red-100 text-red-600 mb-4">
                    <IconX size={40} stroke={3} />
                  </div>
                  <Text size="lg" fw={600} c="red.9">오류</Text>
                  <Text size="sm" c="red.7" mt={2}>{message}</Text>
                  <Button
                    variant="subtle"
                    color="red"
                    radius="xl"
                    mt="lg"
                    onClick={(e) => {
                      e.stopPropagation();
                      setStatus('idle');
                    }}
                  >
                    다시 시도하기
                  </Button>
                </div>
              )}
            </Transition>
          </Paper>
        </Stack>

        <div className="absolute bottom-4 left-0 w-full text-center text-xs text-gray-400">
          KoPubWorld Dotum Light | Client-side Processing
        </div>
      </Container>
    </div>
  );
}
