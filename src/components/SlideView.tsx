import { motion, AnimatePresence } from "motion/react";

interface Props {
  content: string;
  slideNumber: number;
  totalSlides: number;
  topic: string;
  courseCode?: string;
}

function parseSlide(raw: string) {
  const lines = raw.split("\n").map((l) => l.trimEnd()).filter((l) => l !== "");
  let title = "";
  let subtitle = "";
  const bullets: string[] = [];
  const body: string[] = [];

  for (const line of lines) {
    if (!title && line.startsWith("# ")) {
      title = line.replace(/^# /, "").trim();
    } else if (!subtitle && line.startsWith("## ")) {
      subtitle = line.replace(/^## /, "").trim();
    } else if (line.match(/^[-•*]\s+/) || line.match(/^\d+\.\s+/)) {
      bullets.push(line.replace(/^[-•*\d.]\s+/, "").trim());
    } else if (line.startsWith("### ")) {
      body.push(line.replace(/^### /, "").trim());
    } else {
      body.push(line.trim());
    }
  }

  if (!title && lines.length > 0) {
    title = lines[0];
    body.shift();
  }

  return { title, subtitle, bullets, body };
}

export default function SlideView({ content, slideNumber, totalSlides, topic, courseCode }: Props) {
  const { title, subtitle, bullets, body } = parseSlide(content);
  const isTitleSlide = !bullets.length && !body.length;
  const dots = Math.min(totalSlides, 24);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={slideNumber}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="relative w-full rounded-[14px] overflow-hidden select-none"
        style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 65%, #0f172a 100%)" }}
      >
        {/*
          Aspect ratio spacer:
          Mobile  → 4:3  (paddingTop 75%)  — gives ~255px tall on a 340px-wide phone
          sm+     → 16:9 (paddingTop 56.25%) — standard landscape presentation
        */}
        <div className="block sm:hidden" style={{ paddingTop: "75%" }} />
        <div className="hidden sm:block" style={{ paddingTop: "56.25%" }} />

        {/* Content — absolutely fills the spacer */}
        <div className="absolute inset-0 flex flex-col p-4 sm:p-8 lg:p-12">

          {/* Header */}
          <div className="flex items-center justify-between mb-2 sm:mb-5 flex-shrink-0">
            <span className="text-[9px] sm:text-[10px] font-mono font-bold text-slate-500 uppercase tracking-[0.15em] truncate mr-2">
              {courseCode && <>{courseCode} · </>}{topic}
            </span>
            <span className="text-[9px] sm:text-[11px] font-mono text-slate-600 tabular-nums flex-shrink-0">
              {slideNumber}/{totalSlides}
            </span>
          </div>

          {/* Main content */}
          <div className={`flex-1 flex flex-col min-h-0 ${isTitleSlide ? "items-center justify-center text-center" : "justify-center"}`}>

            {/* Title */}
            {title && (
              <h1 className={`font-black leading-tight text-white tracking-tight
                ${isTitleSlide
                  ? "text-[22px] sm:text-[32px] lg:text-[46px] max-w-[92%]"
                  : "text-[17px] sm:text-[26px] lg:text-[38px] mb-1.5 sm:mb-3"}`}>
                {title}
              </h1>
            )}

            {/* Subtitle */}
            {subtitle && (
              <p className={`font-semibold text-emerald-400 leading-snug
                ${isTitleSlide
                  ? "text-[13px] sm:text-[18px] lg:text-[24px] mt-2 sm:mt-4 max-w-[82%]"
                  : "text-[12px] sm:text-[15px] lg:text-[19px] mb-2 sm:mb-3"}`}>
                {subtitle}
              </p>
            )}

            {/* Accent line */}
            {title && !isTitleSlide && (
              <div className="w-7 sm:w-14 h-[3px] bg-emerald-500 rounded-full mb-2 sm:mb-5 flex-shrink-0" />
            )}

            {/* Bullets */}
            {bullets.length > 0 && (
              <ul className="space-y-[6px] sm:space-y-3 mt-0.5">
                {bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 sm:gap-3">
                    <span className="flex-shrink-0 mt-[0.38em] w-[6px] h-[6px] sm:w-2 sm:h-2 rounded-full bg-emerald-500" />
                    <span className="text-slate-200 leading-snug text-[13px] sm:text-[15px] lg:text-[17px]">
                      {b}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {/* Body paragraphs */}
            {body.length > 0 && (
              <div className="mt-2 sm:mt-3 space-y-1 sm:space-y-2">
                {body.map((line, i) => (
                  <p key={i} className="text-slate-300 leading-relaxed text-[12px] sm:text-[14px] lg:text-[16px]">
                    {line}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-2 sm:mt-4 pt-2 sm:pt-3 border-t border-white/[0.07] flex-shrink-0">
            <div className="flex gap-[3px] sm:gap-1 flex-wrap max-w-[75%]">
              {Array.from({ length: dots }).map((_, i) => (
                <div
                  key={i}
                  className={`h-[2px] sm:h-[3px] rounded-full transition-all duration-300
                    ${i === slideNumber - 1
                      ? "bg-emerald-500 w-3 sm:w-6"
                      : "bg-white/20 w-[5px] sm:w-2"}`}
                />
              ))}
            </div>
            <span className="hidden sm:block text-[9px] font-mono text-slate-600 uppercase tracking-widest">
              Quiz Portal
            </span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
