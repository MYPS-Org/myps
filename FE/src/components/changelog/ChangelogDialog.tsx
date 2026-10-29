import React from 'react';
import { Dialog, DialogPanel, DialogTitle, Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/react';
import { ChevronDownIcon, XMarkIcon } from '@heroicons/react/24/outline';
import ChangelogMarkdown from './ChangelogMarkdown';
import { releases } from './changelogs';

interface ChangelogDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Slide-over listing every release in docs/changelogs, newest first and open. */
const ChangelogDialog: React.FC<ChangelogDialogProps> = ({ isOpen, onClose }) => (
  <Dialog open={isOpen} onClose={onClose} className="relative z-50">
    <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

    <div className="fixed inset-y-0 right-0 flex w-full max-w-2xl">
      <DialogPanel className="flex w-full flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <DialogTitle className="text-lg font-semibold text-gray-900">Changelogs</DialogTitle>
            <p className="mt-0.5 text-sm text-gray-500">What changed in each MYPS release, newest first.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close changelogs"
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
          {releases.length === 0 && (
            <p className="py-10 text-center text-sm text-gray-500">No release notes yet.</p>
          )}
          {releases.map((release, index) => (
            <Disclosure key={release.version} as="section" defaultOpen={index === 0} className="rounded-lg border border-gray-200">
              <DisclosureButton className="group flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50">
                <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">{release.version}</span>
                <span className="flex-1 text-sm font-medium text-gray-900">{release.title}</span>
                {release.unreleased && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Not yet released</span>
                )}
                <ChevronDownIcon className="h-4 w-4 text-gray-400 transition-transform group-data-[open]:rotate-180" />
              </DisclosureButton>
              <DisclosurePanel className="border-t border-gray-100 px-4 pb-4 pt-3">
                {release.subtitle && <p className="mb-3 text-xs text-gray-500">{release.subtitle}</p>}
                <ChangelogMarkdown markdown={release.body} />
              </DisclosurePanel>
            </Disclosure>
          ))}
        </div>
      </DialogPanel>
    </div>
  </Dialog>
);

export default ChangelogDialog;
