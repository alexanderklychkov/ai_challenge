import { Switch as HeadlessSwitch } from '@headlessui/react';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  className?: string;
}

const Switch = ({ checked, onChange, label, className = '' }: SwitchProps) => {
  return (
    <HeadlessSwitch
      checked={checked}
      onChange={onChange}
      className={`
        group relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full
        transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2
        focus:ring-[#00f0ff] focus:ring-offset-2 focus:ring-offset-[#151520]
        ${checked ? 'bg-gradient-to-r from-[#0066ff] to-[#8000cc]' : 'bg-[#2a2a3a]'}
        ${className}
      `}
    >
      <span className="sr-only">{label || 'Toggle'}</span>
      <span
        className={`
          pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg
          ring-0 transition duration-200 ease-in-out
          ${checked ? 'translate-x-6' : 'translate-x-1'}
        `}
      />
    </HeadlessSwitch>
  );
};

export default Switch;



