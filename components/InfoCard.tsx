type InfoCardProps = {
  label: string | React.ReactNode;
  value: any;
  size?: 'default' | 'large';
  highlight?: boolean;
};

export function InfoCard({ label, value, size = 'default', highlight = false }: InfoCardProps) {
  // แปลงค่า value เป็น string ทุกครั้ง
  const displayValue = String(value);

  return (
    <div className={`
      text-center p-5 sm:p-7 rounded-[2rem] border-2
      ${highlight 
        ? 'bg-gradient-to-br from-pink-50 via-white to-pink-50/50 border-pink-200/80' 
        : 'bg-gradient-to-br from-white to-pink-50/20 border-pink-100/80'
      }
      transition-all duration-300 group
      transform hover:scale-[1.03] relative overflow-hidden
      ${size === 'large' ? 'col-span-2 lg:col-span-1' : ''}
    `}>
      <div className="absolute top-0 right-0 w-20 h-20 bg-pink-200/20 rounded-full blur-2xl"></div>
      <div className="absolute bottom-0 left-0 w-20 h-20 bg-pink-200/20 rounded-full blur-2xl"></div>
      
      <div className={`
        text-xs sm:text-sm mb-2
        ${highlight ? 'text-pink-700 font-bold' : 'text-pink-600 font-semibold'}
        relative z-10 flex items-center justify-center gap-1.5
      `}>
        {highlight && (
          <div className="w-2 h-2 rounded-full bg-pink-500 animate-pulse"></div>
        )}
        {label}
      </div>
      <div className={`
        font-black tracking-tight
        ${size === 'large' ? 'text-6xl sm:text-7xl' : 'text-3xl sm:text-5xl'}
        ${highlight 
          ? 'text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-pink-500' 
          : 'text-transparent bg-clip-text bg-gradient-to-r from-pink-800 to-pink-600'
        }
        group-hover:scale-110 transition-transform duration-300
        relative z-10
      `}>
        {displayValue}
      </div>
      {highlight && (
        <div className="absolute inset-0 bg-gradient-to-br from-pink-100/40 via-transparent to-transparent opacity-60 pointer-events-none" />
      )}
    </div>
  );
}