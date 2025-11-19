import React from 'react'
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/react/24/outline'
import { useModal } from './ModalContext'


/*

  const handleDelete = async () => {
    const result = await showModal({
      icon: 'error',
      Title: 'Delete Item',
      Message: 'Are you sure you want to delete this item?',
      button: ['Delete', 'Cancel'],
	  type: 'confirm' // optional, defaults to 'confirm' if not provided. types are 'confirm' and 'alert'
    })
    return result;
  }
    const res = await handleDelete();
	// will return true of false
*/
const GlobalModal: React.FC = () => {
  	const { open, data, confirm, cancel } = useModal()
	const getIcon = (type: 'error' | 'info' | 'success') => {
		switch (type) {
			case 'error':
			return <ExclamationTriangleIcon className="size-6 text-red-600" />
			case 'info':
			return <InformationCircleIcon className="size-6 text-blue-600" />
			case 'success':
			return <CheckCircleIcon className="size-6 text-green-600" />
			default:
			return <InformationCircleIcon className="size-6 text-blue-600" />
		}
	};
	const Icon = getIcon(data.icon as any) as React.ReactNode;

	return (
		<Dialog open={open} onClose={() => {}} className="relative z-10">
		<DialogBackdrop className="fixed inset-0 bg-gray-500/75" />
		<div className="fixed inset-0 z-10 w-screen overflow-y-auto">
			<div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
			<DialogPanel className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl sm:my-8 sm:w-full sm:max-w-lg">
				<div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
				<div className="sm:flex sm:items-start">
					<div className="mx-auto flex size-12 shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:size-10">
					{Icon}
					</div>
					<div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
					<DialogTitle as="h3" className="text-base font-semibold text-gray-900">
						{data.Title}
					</DialogTitle>
					<div className="mt-2">
						<p className="text-sm text-gray-500">{data.Message}</p>
					</div>
					</div>
				</div>
				</div>
				<div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
				<button
					type="button"
					onClick={confirm}
					className="inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500 sm:ml-3 sm:w-auto"
				>
					{data.button?.[0] ?? 'Confirm'}
				</button>
				{data.type === 'confirm' && (
				<button
					type="button"
					onClick={cancel}
					className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 sm:mt-0 sm:w-auto"
				>
					{data.button?.[1] ?? 'Cancel'}
				</button>)}
				</div>
			</DialogPanel>
			</div>
		</div>
		</Dialog>
	)
}

export default GlobalModal