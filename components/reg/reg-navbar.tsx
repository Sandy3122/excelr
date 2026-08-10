import Image from "next/image";

/** White bar with a centered ExcelR logo (spec §3.1). Both breakpoints. */
export default function RegNavbar() {
  return (
    <header className="w-full border-b border-slate-100 bg-white">
      <div className="mx-auto flex h-[60px] max-w-content items-center justify-center px-6 md:h-[88px]">
        <Image
          src="/reg/excelr-logo.png"
          alt="ExcelR — Raising Excellence"
          width={522}
          height={135}
          priority
          className="h-9 w-auto md:h-12"
        />
      </div>
    </header>
  );
}
