import { RadioGroup as HeadlessRadioGroup } from '@headlessui/react';

interface RadioOption {
  value: string;
  label: string;
  description?: string;
}

interface RadioGroupProps {
  value: string;
  onChange: (value: string) => void;
  options: RadioOption[];
  className?: string;
}

const RadioGroup = ({ value, onChange, options, className = '' }: RadioGroupProps) => {
  return (
    <HeadlessRadioGroup value={value} onChange={onChange} className={className}>
      <div className="space-y-2">
        {options.map((option) => (
          <HeadlessRadioGroup.Option
            key={option.value}
            value={option.value}
            className={({ checked, active }) =>
              `relative flex cursor-pointer rounded-lg border p-3 focus:outline-none transition-all ${
                checked
                  ? 'border-[#00f0ff] bg-[#00f0ff]/10'
                  : active
                  ? 'border-[#2a2a3a] bg-[#2a2a3a]/60'
                  : 'border-[#2a2a3a] bg-[#1e1e2e]/60 hover:bg-[#2a2a3a]/60'
              }`
            }
          >
            {({ checked }) => (
              <>
                <div className="flex w-full items-start gap-3">
                  <div className="flex h-5 items-center">
                    <div
                      className={`h-4 w-4 rounded-full border-2 transition-all ${
                        checked
                          ? 'border-[#00f0ff] bg-[#00f0ff]'
                          : 'border-[#505060] bg-transparent'
                      }`}
                    >
                      {checked && (
                        <div className="h-full w-full rounded-full bg-[#151520] scale-[0.4]" />
                      )}
                    </div>
                  </div>
                  <div className="flex-1">
                    <HeadlessRadioGroup.Label
                      as="div"
                      className="text-sm font-medium text-[#e0e0e8] cursor-pointer"
                    >
                      {option.label}
                    </HeadlessRadioGroup.Label>
                    {option.description && (
                      <HeadlessRadioGroup.Description
                        as="div"
                        className="text-xs text-[#a0a0b0] mt-1"
                      >
                        {option.description}
                      </HeadlessRadioGroup.Description>
                    )}
                  </div>
                </div>
              </>
            )}
          </HeadlessRadioGroup.Option>
        ))}
      </div>
    </HeadlessRadioGroup>
  );
};

export default RadioGroup;







