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
      text-center p-4 sm:p-6 rounded-3xl border-2
      ${highlight ? 'bg-gradient-to-br from-pink-50 to-white border-pink-200' : 'bg-white border-pink-100'}
      transition-all duration-300 hover:shadow-lg group
      transform hover:scale-[1.02] relative overflow-hidden
      ${size === 'large' ? 'col-span-2 lg:col-span-1' : ''}
    `}>
      <div className={`
        text-sm sm:text-base mb-1
        ${highlight ? 'text-pink-700 font-semibold' : 'text-pink-600 font-medium'}
        relative z-10
      `}>
        {label}
      </div>
      <div className={`
        font-extrabold tracking-tight
        ${size === 'large' ? 'text-5xl sm:text-6xl' : 'text-2xl sm:text-4xl'}
        ${highlight ? 'text-pink-600' : 'text-pink-800'}
        group-hover:scale-105 transition-transform duration-300
        relative z-10
      `}>
        {displayValue}
      </div>
      {highlight && (
        <div className="absolute inset-0 bg-gradient-to-br from-pink-100/50 to-transparent opacity-50 pointer-events-none" />
      )}
    </div>
  );
}