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

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={slideNumber}
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -24 }}
        transition={{ duration: 0.22, ease: "easeInOut" }}
        className="relative w-full rounded-[14px] overflow-hidden select-none"
        style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)" }}
      >
        {/* 16:9 aspect ratio spacer */}
        <div style={{ paddingTop: "56.25%" }} />

        {/* Slide content — absolutely fills the spacer */}
        <div className="absolute inset-0 flex flex-col px-8 py-6 sm:px-14 sm:py-10">

          {/* Header bar */}
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <span className="text-[9px] sm:text-[10px] font-mono font-bold text-slate-500 uppercase tracking-[0.2em]">
              {courseCode && <>{courseCode} · </>}{topic}
            </span>
            <span className="text-[9px] sm:text-[10px] font-mono text-slate-600 tabular-nums">
              {slideNumber}/{totalSlides}
            </span>
          </div>

          {/* Main content */}
          <div className={`flex-1 flex flex-col ${isTitleSlide ? "items-center justify-center text-center" : "justify-center"}`}>

            {/* Title */}
            {title && (
              <h1 className={`font-black leading-tight text-white tracking-tight
                ${isTitleSlide
                  ? "text-[5.5vw] sm:text-[3.8vw] lg:text-[2.6rem] max-w-[90%]"
                  : "text-[4vw] sm:text-[2.8vw] lg:text-[1.85rem] mb-2 sm:mb-3"}`}>
                {title}
              </h1>
            )}

            {/* Subtitle */}
            {subtitle && (
              <p className={`font-semibold text-emerald-400 leading-snug
                ${isTitleSlide
                  ? "text-[3vw] sm:text-[2vw] lg:text-[1.2rem] mt-3 max-w-[80%]"
                  : "text-[2.8vw] sm:text-[1.8vw] lg:text-[1.05rem] mb-3"}`}>
                {subtitle}
              </p>
            )}

            {/* Accent line under title */}
            {title && !isTitleSlide && (
              <div className="w-10 sm:w-14 h-[3px] bg-emerald-500 rounded-full mb-3 sm:mb-5" />
            )}

            {/* Bullets */}
            {bullets.length > 0 && (
              <ul className="space-y-1.5 sm:space-y-2.5 mt-1">
                {bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2.5 sm:gap-3">
                    <span className="flex-shrink-0 mt-[0.3em] w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500" />
                    <span className="text-slate-200 leading-snug text-[2.8vw] sm:text-[1.75vw] lg:text-[0.95rem]">{b}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* Body paragraphs (non-bullet, non-heading lines) */}
            {body.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {body.map((line, i) => (
                  <p key={i} className="text-slate-300 leading-relaxed text-[2.5vw] sm:text-[1.6vw] lg:text-[0.88rem]">{line}</p>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-3 sm:mt-5 pt-2 sm:pt-3 border-t border-white/[0.07]">
            <div className="flex gap-1">
              {Array.from({ length: totalSlides }).map((_, i) => (
                <div key={i} className={`h-[3px] rounded-full transition-all duration-300
                  ${i === slideNumber - 1 ? "bg-emerald-500 w-4 sm:w-6" : "bg-white/20 w-1.5 sm:w-2"}`} />
              ))}
            </div>
            <span className="text-[8px] sm:text-[9px] font-mono text-slate-600 uppercase tracking-widest">Quiz Portal</span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
