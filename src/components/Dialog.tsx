import { Fragment } from 'react';
import { Dialog as HeadlessDialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const Dialog = ({ open, onClose, title, children, footer }: DialogProps) => {
  return (
    <Transition show={open} as={Fragment}>
      <HeadlessDialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <HeadlessDialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-xl bg-[#151520] border border-[#2a2a3a] shadow-[0_0_30px_rgba(0,240,255,0.3)] transition-all">
                {title && (
                  <div className="flex items-center justify-between p-4 border-b border-[#2a2a3a]">
                    <HeadlessDialog.Title as="div" className="text-lg font-semibold gradient-text">
                      {title}
                    </HeadlessDialog.Title>
                    <button
                      onClick={onClose}
                      className="p-1 hover:bg-[#2a2a3a] rounded text-[#a0a0b0] hover:text-[#e0e0e8] transition-colors cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                )}
                <div className="flex-1 overflow-y-auto p-4">{children}</div>
                {footer && (
                  <div className="flex items-center justify-end gap-3 p-4 border-t border-[#2a2a3a]">
                    {footer}
                  </div>
                )}
              </HeadlessDialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </HeadlessDialog>
    </Transition>
  );
};

export default Dialog;

