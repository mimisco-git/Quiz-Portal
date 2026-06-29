import React from "react";

interface FUTOLogoProps {
  className?: string;
  showText?: boolean;
}

export default function FUTOLogo({ className = "h-12 w-12", showText = false }: FUTOLogoProps) {
  return (
    <div className={`flex items-center gap-3 ${showText ? "" : "justify-center"}`} id="futo-logo-wrapper">
      <svg
        id="futo-logo-svg"
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${className} shrink-0 select-none`}
      >
        <defs>
          {/* Paths for the curved texts */}
          {/* Top text path - clockwise arch */}
          <path
            id="futo-text-path-top"
            d="M 38 90 A 62 62 0 0 1 162 90"
            fill="none"
          />
          {/* Bottom text path - clockwise bottom half arch for OWERRI */}
          <path
            id="futo-text-path-bottom"
            d="M 162 92 A 62 62 0 0 1 38 92"
            fill="none"
          />
          {/* Ribbon text path */}
          <path
            id="futo-ribbon-path"
            d="M 32 163 Q 100 183 168 163"
            fill="none"
          />
        </defs>

        {/* Outer Gold/Yellow Ring Border of the main seal */}
        <circle cx="100" cy="90" r="76" fill="#F59E0B" stroke="#0F172A" strokeWidth="2.5" />
        
        {/* Inner Black border line on outer gold ring */}
        <circle cx="100" cy="90" r="72" fill="none" stroke="#0F172A" strokeWidth="1.5" />

        {/* The White Band for University Name */}
        <circle cx="100" cy="90" r="70" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2" />

        {/* Inner Dark boundary line */}
        <circle cx="100" cy="90" r="50" fill="none" stroke="#0F172A" strokeWidth="2" />

        {/* CENTRAL SHIELD/CIRCLE WITH GREEN/BLACK BACKGROUND */}
        {/* Clip path to contain background inside radius 49 */}
        <g>
          <mask id="inner-circle-mask">
            <circle cx="100" cy="90" r="49" fill="#FFFFFF" />
          </mask>
          
          {/* Green Top Half */}
          <circle cx="100" cy="90" r="49" fill="#15803D" />
          
          {/* Black Bottom Half */}
          <path
            d="M 51 90 A 49 49 0 0 0 149 90 Z"
            fill="#0F172A"
            stroke="#0F172A"
            strokeWidth="1"
          />
        </g>

        {/* LEFT PLAQUE (Scales of Justice) */}
        <g id="left-plaque" transform="translate(62, 78)">
          {/* White rectangular card with black border */}
          <rect x="0" y="0" width="13" height="17" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.2" rx="0.5" />
          {/* Scales of Justice Icon */}
          {/* Center pillar */}
          <line x1="6.5" y1="2" x2="6.5" y2="15" stroke="#0F172A" strokeWidth="1" />
          {/* Crossbeam */}
          <line x1="2.5" y1="5" x2="10.5" y2="5" stroke="#0F172A" strokeWidth="0.75" />
          {/* Left hanging pan */}
          <line x1="3" y1="5" x2="2.5" y2="10" stroke="#0F172A" strokeWidth="0.5" />
          <line x1="3" y1="5" x2="4.5" y2="10" stroke="#0F172A" strokeWidth="0.5" />
          <path d="M 1.5 10 L 5.5 10 A 1.5 1.5 0 0 1 3.5 11.5 Z" fill="#0F172A" />
          {/* Right hanging pan */}
          <line x1="10" y1="5" x2="8.5" y2="10" stroke="#0F172A" strokeWidth="0.5" />
          <line x1="10" y1="5" x2="10.5" y2="10" stroke="#0F172A" strokeWidth="0.5" />
          <path d="M 7.5 10 L 11.5 10 A 1.5 1.5 0 0 1 9.5 11.5 Z" fill="#0F172A" />
          {/* Base */}
          <line x1="4.5" y1="15" x2="8.5" y2="15" stroke="#0F172A" strokeWidth="1" />
        </g>

        {/* RIGHT PLAQUE (Microscope / Laboratory Equipment) */}
        <g id="right-plaque" transform="translate(125, 78)">
          {/* White rectangular card with black border */}
          <rect x="0" y="0" width="13" height="17" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.2" rx="0.5" />
          {/* Microscope Icon */}
          {/* Base */}
          <path d="M 2.5 14.5 L 10.5 14.5" stroke="#0F172A" strokeWidth="1.2" strokeLinecap="round" />
          {/* Pillar / Limb */}
          <path d="M 8.5 14.5 C 8.5 11.5, 9.5 7.5, 7.5 5.5" fill="none" stroke="#0F172A" strokeWidth="1.2" strokeLinecap="round" />
          {/* Stage */}
          <line x1="3.5" y1="10.5" x2="7.5" y2="10.5" stroke="#0F172A" strokeWidth="1" />
          {/* Body Tube / Objective */}
          <line x1="5" y1="4" x2="7.5" y2="8" stroke="#0F172A" strokeWidth="1.8" strokeLinecap="round" />
          {/* Light reflector mirror */}
          <line x1="5.5" y1="12.5" x2="7.5" y2="12.5" stroke="#0F172A" strokeWidth="0.75" />
        </g>

        {/* CENTRAL COGWHEEL (GEAR) & OPEN BOOK */}
        <g id="central-gear" transform="translate(100, 90)">
          {/* Gear wheel teeth - rendered precisely using transform rotates */}
          <g fill="#F59E0B" stroke="#0F172A" strokeWidth="1" strokeLinejoin="round">
            <rect x="-3" y="-17" width="6" height="6" rx="0.5" />
            <rect x="-3" y="-17" width="6" height="6" rx="0.5" transform="rotate(30)" />
            <rect x="-3" y="-17" width="6" height="6" rx="0.5" transform="rotate(60)" />
            <rect x="-3" y="-17" width="6" height="6" rx="0.5" transform="rotate(90)" />
            <rect x="-3" y="-17" width="6" height="6" rx="0.5" transform="rotate(120)" />
            <rect x="-3" y="-17" width="6" height="6" rx="0.5" transform="rotate(150)" />
            <rect x="-3" y="-17" width="6" height="6" rx="0.5" transform="rotate(180)" />
            <rect x="-3" y="-17" width="6" height="6" rx="0.5" transform="rotate(210)" />
            <rect x="-3" y="-17" width="6" height="6" rx="0.5" transform="rotate(240)" />
            <rect x="-3" y="-17" width="6" height="6" rx="0.5" transform="rotate(270)" />
            <rect x="-3" y="-17" width="6" height="6" rx="0.5" transform="rotate(300)" />
            <rect x="-3" y="-17" width="6" height="6" rx="0.5" transform="rotate(330)" />
          </g>

          {/* Internal core of the gear wheel */}
          <circle cx="0" cy="0" r="13" fill="#F59E0B" stroke="#0F172A" strokeWidth="1" />
          <circle cx="0" cy="0" r="9" fill="#0F172A" stroke="#0F172A" strokeWidth="0.5" />

          {/* Open Book of Knowledge in the absolute center */}
          <g transform="translate(-5.5, -4.5)" fill="#FFFFFF" stroke="#0F172A" strokeWidth="0.5">
            <path d="M 0.5 2 C 2 0.5, 4.5 0.5, 5.5 2 C 6.5 0.5, 9 0.5, 10.5 2 L 10.5 7 C 9 5.5, 6.5 5.5, 5.5 7 C 4.5 5.5, 2 5.5, 0.5 7 Z" fill="#FFFFFF" strokeLinejoin="round" />
            <line x1="5.5" y1="2" x2="5.5" y2="7" stroke="#0F172A" strokeWidth="0.5" />
            {/* Small fine lines representing book text */}
            <line x1="2" y1="3.5" x2="4" y2="3.5" stroke="#0F172A" strokeWidth="0.3" />
            <line x1="2" y1="4.8" x2="4" y2="4.8" stroke="#0F172A" strokeWidth="0.3" />
            <line x1="7" y1="3.5" x2="9" y2="3.5" stroke="#0F172A" strokeWidth="0.3" />
            <line x1="7" y1="4.8" x2="9" y2="4.8" stroke="#0F172A" strokeWidth="0.3" />
          </g>
        </g>

        {/* CURVED TEXTS inside the white concentric band */}
        {/* Top Text: FEDERAL UNIVERSITY OF TECHNOLOGY */}
        <text fontFamily="system-ui, sans-serif" fontWeight="900" fontSize="8.8" fill="#0F172A">
          <textPath href="#futo-text-path-top" startOffset="50%" textAnchor="middle" letterSpacing="0.4">
            FEDERAL UNIVERSITY OF TECHNOLOGY
          </textPath>
        </text>

        {/* Bottom Text: OWERRI flanked by small star/dots */}
        <circle cx="48" cy="116" r="1.8" fill="#0F172A" />
        <circle cx="152" cy="116" r="1.8" fill="#0F172A" />
        
        <text fontFamily="system-ui, sans-serif" fontWeight="900" fontSize="10" fill="#0F172A">
          <textPath href="#futo-text-path-bottom" startOffset="50%" textAnchor="middle" letterSpacing="1.2">
            OWERRI
          </textPath>
        </text>

        {/* BOTTOM SCROLL BANNER (TECHNOLOGY FOR SERVICE Ribbon) */}
        {/* Banner shadow underlays (for folded 3D ribbon effect) */}
        {/* Left folded back connection */}
        <path d="M 33 151 L 21 161 L 21 172 L 33 162 Z" fill="#D97706" stroke="#0F172A" strokeWidth="1.5" strokeLinejoin="round" />
        {/* Right folded back connection */}
        <path d="M 167 151 L 179 161 L 179 172 L 167 162 Z" fill="#D97706" stroke="#0F172A" strokeWidth="1.5" strokeLinejoin="round" />

        {/* Outer Ribbon Swallowtails */}
        {/* Left Ribbon end tail */}
        <path d="M 21 161 L 9 156 L 14 167 L 9 178 L 21 172 Z" fill="#F59E0B" stroke="#0F172A" strokeWidth="1.5" strokeLinejoin="round" />
        {/* Right Ribbon end tail */}
        <path d="M 179 161 L 191 156 L 186 167 L 191 178 L 179 172 Z" fill="#F59E0B" stroke="#0F172A" strokeWidth="1.5" strokeLinejoin="round" />

        {/* Green Accent Stripes inside the swallowtails */}
        <path d="M 17 161.5 L 11 159.5 L 14.5 167 L 11 174.5 L 17 172 Z" fill="#15803D" />
        <path d="M 183 161.5 L 189 159.5 L 185.5 167 L 189 174.5 L 183 172 Z" fill="#15803D" />

        {/* Main Ribbon Center Banner */}
        <path
          d="M 31 151 Q 100 171 169 151 L 169 165 Q 100 185 31 165 Z"
          fill="#FFFFFF"
          stroke="#0F172A"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />

        {/* Yellow-gold and Green border linings running along the inner curves of the white banner */}
        <path d="M 34 153 Q 100 172.5 166 153" stroke="#F59E0B" strokeWidth="1.5" fill="none" />
        <path d="M 34 163 Q 100 182.5 166 163" stroke="#15803D" strokeWidth="1.5" fill="none" />

        {/* Banner Text: TECHNOLOGY FOR SERVICE */}
        <text fontFamily="system-ui, sans-serif" fontWeight="900" fontSize="8.4" fill="#0F172A">
          <textPath href="#futo-ribbon-path" startOffset="50%" textAnchor="middle" letterSpacing="0.3">
            TECHNOLOGY FOR SERVICE
          </textPath>
        </text>
      </svg>

      {showText && (
        <div className="flex flex-col text-left">
          <span className="text-sm font-black tracking-wider text-slate-950 font-display uppercase leading-tight">
            FUTO
          </span>
          <span className="text-[9px] text-slate-400 font-mono uppercase tracking-widest font-bold leading-none">
            Technology for Service
          </span>
        </div>
      )}
    </div>
  );
}

