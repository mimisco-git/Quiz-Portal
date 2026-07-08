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
      bullets.push(line.replace(/^([-•*]|\d+\.)\s+/, "").trim());
    } else if (line.startsWith("### ")) {
      body.push(line.replace(/^### /, "").trim());
    } else {
      body.push(line.trim());
    }
  }

  // If no markdown heading found, first line becomes the title
  if (!title && lines.length > 0) {
    title = lines[0];
    // Remove it from body if it got added there
    const idx = body.indexOf(title);
    if (idx !== -1) body.splice(idx, 1);
  }

  return { title, subtitle, bullets, body };
}

export default function SlideView({ content, slideNumber, totalSlides, topic, courseCode }: Props) {
  const { title, subtitle, bullets, body } = parseSlide(content);
  const isTitleSlide = bullets.length === 0 && body.length === 0;
  const dots = Math.min(totalSlides, 20);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={slideNumber}
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -16 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        // max-w-full + overflow-hidden are the hard guards against blowout
        className="w-full max-w-full overflow-hidden rounded-2xl"
        style={{ background: "linear-gradient(135deg,#0f172a 0%,#1e293b 65%,#0f172a 100%)" }}
      >
        {/*
          Mobile  (default): static flex column, fixed height 300px, scrollable content
          sm+   : 16:9 aspect-ratio trick with absolute overlay
        */}

        {/* ── MOBILE LAYOUT — auto height, all content visible, no scroll ── */}
        <div className="flex sm:hidden flex-col w-full overflow-x-hidden">
          {/* header */}
          <div className="flex items-center justify-between px-3 pt-3 pb-1.5">
            <span className="text-[8px] font-mono font-bold text-slate-500 uppercase tracking-[0.12em] truncate mr-2 max-w-[65%]">
              {courseCode && <>{courseCode} · </>}{topic}
            </span>
            <span className="text-[8px] font-mono text-slate-600 tabular-nums flex-shrink-0">
              {slideNumber}/{totalSlides}
            </span>
          </div>

          {/* content — grows to fit everything */}
          <div className={`overflow-x-hidden px-3 pb-1 w-full ${isTitleSlide ? "flex flex-col items-center justify-center text-center py-6" : "py-2"}`}>
            {title && (
              <h1 className={`font-bold leading-tight text-white tracking-tight break-words w-full ${isTitleSlide ? "text-[18px]" : "text-[13px] mb-1"}`}>
                {title}
              </h1>
            )}
            {subtitle && (
              <p className={`font-semibold text-emerald-400 leading-snug break-words w-full ${isTitleSlide ? "text-[12px] mt-1.5" : "text-[11px] mb-1"}`}>
                {subtitle}
              </p>
            )}
            {title && !isTitleSlide && (
              <div className="w-6 h-[2px] bg-emerald-500 rounded-full mb-1.5" />
            )}
            {bullets.length > 0 && (
              <ul className="space-y-[5px] mt-1 w-full">
                {bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-1.5 min-w-0 w-full">
                    <span className="flex-shrink-0 mt-[4px] w-[4px] h-[4px] rounded-full bg-emerald-500" />
                    <span className="text-slate-200 text-[11.5px] leading-snug break-words min-w-0 flex-1">{b}</span>
                  </li>
                ))}
              </ul>
            )}
            {body.length > 0 && (
              <div className="mt-1.5 space-y-[4px] w-full">
                {body.map((line, i) => (
                  <p key={i} className="text-slate-300 text-[11px] leading-relaxed break-words w-full">{line}</p>
                ))}
              </div>
            )}
          </div>

          {/* footer */}
          <div className="flex items-center px-3 pb-2.5 pt-1.5 border-t border-white/[0.07] mt-1">
            <div className="flex gap-[3px] flex-wrap">
              {Array.from({ length: dots }).map((_, i) => (
                <div key={i} className={`h-[2px] rounded-full transition-all duration-300 ${i === slideNumber - 1 ? "bg-emerald-500 w-3" : "bg-white/20 w-[4px]"}`} />
              ))}
            </div>
          </div>
        </div>

        {/* ── DESKTOP LAYOUT (sm+): 16:9 aspect ratio with absolute overlay ── */}
        <div className="hidden sm:block relative w-full">
          <div style={{ paddingTop: "56.25%" }} />
          <div className="absolute inset-0 overflow-hidden flex flex-col p-8 lg:p-12">
            {/* header */}
            <div className="flex-shrink-0 flex items-center justify-between mb-5">
              <span className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-[0.15em] truncate mr-2">
                {courseCode && <>{courseCode} · </>}{topic}
              </span>
              <span className="text-[11px] font-mono text-slate-600 tabular-nums flex-shrink-0">
                {slideNumber}/{totalSlides}
              </span>
            </div>

            {/* content */}
            <div className={`flex-1 flex flex-col min-h-0 overflow-hidden ${isTitleSlide ? "items-center justify-center text-center" : "justify-center"}`}>
              {title && (
                <h1 className={`font-black leading-tight text-white tracking-tight break-words ${isTitleSlide ? "text-[36px] lg:text-[48px] max-w-[90%]" : "text-[26px] lg:text-[38px] mb-3"}`}>
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className={`font-semibold text-emerald-400 leading-snug break-words ${isTitleSlide ? "text-[18px] lg:text-[24px] mt-4 max-w-[80%]" : "text-[15px] lg:text-[19px] mb-3"}`}>
                  {subtitle}
                </p>
              )}
              {title && !isTitleSlide && (
                <div className="w-14 h-[3px] bg-emerald-500 rounded-full mb-5 flex-shrink-0" />
              )}
              {bullets.length > 0 && (
                <ul className="space-y-3 mt-1">
                  {bullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-3 min-w-0">
                      <span className="flex-shrink-0 mt-[7px] w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-slate-200 text-[16px] lg:text-[18px] leading-snug break-words min-w-0 flex-1">{b}</span>
                    </li>
                  ))}
                </ul>
              )}
              {body.length > 0 && (
                <div className="mt-3 space-y-2">
                  {body.map((line, i) => (
                    <p key={i} className="text-slate-300 text-[14px] lg:text-[16px] leading-relaxed break-words">{line}</p>
                  ))}
                </div>
              )}
            </div>

            {/* footer */}
            <div className="flex-shrink-0 flex items-center justify-between mt-4 pt-3 border-t border-white/[0.07]">
              <div className="flex gap-1 flex-wrap max-w-[70%]">
                {Array.from({ length: dots }).map((_, i) => (
                  <div key={i} className={`h-[3px] rounded-full transition-all duration-300 ${i === slideNumber - 1 ? "bg-emerald-500 w-6" : "bg-white/20 w-2"}`} />
                ))}
              </div>
              <span className="text-[9px] font-mono text-slate-600 uppercase tracking-widest">Quiz Portal</span>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
