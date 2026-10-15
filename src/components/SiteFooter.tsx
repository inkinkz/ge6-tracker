/** Disclaimer and credits shown at the bottom of every page. */
export function SiteFooter({ children }: { children?: React.ReactNode }) {
  return (
    <footer className='mt-12 space-y-1.5 text-center text-xs leading-relaxed text-muted'>
      {children}
      <p>
        เว็บไซต์นี้จัดทำโดยแฟนคลับเพื่อความสะดวกในการติดตาม ไม่ใช่ช่องทางทางการของ BNK48 / CGM48
        หรือผู้จัดงาน
      </p>
      <p>ข้อมูลทั้งหมดอ่านจากบล็อกเชนสาธารณะ Token X ผ่าน Token X Scan</p>
      <div className='pt-2'>
        <a
          href='https://x.com/miwoorii'
          target='_blank'
          rel='noopener noreferrer'
          aria-label='miwoori บน X (Twitter)'
          className='inline-flex items-center gap-2 rounded-2xl py-1.5 pl-1.5 transition-colors hover:bg-surface-2'
        >
          <span className='grid size-5 place-items-center rounded-md bg-[#1e2939] text-white'>
            <svg viewBox='0 0 24 24' className='size-[12px]' fill='currentColor' aria-hidden>
              <path d='M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z' />
            </svg>
          </span>
          <span className='bg-gradient-to-r from-[#9f9bcf] to-[#62bb98] bg-clip-text text-sm font-semibold tracking-tight text-transparent'>
            miwoori
          </span>
        </a>
      </div>
    </footer>
  );
}
