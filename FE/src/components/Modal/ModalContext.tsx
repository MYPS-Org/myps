import React, { createContext, useContext, useState, useRef } from 'react'
type ModalType = 'confirm' | 'alert'

type ModalData = {
	icon?: string
	Title: string
	Message: string
	type?: ModalType // default to 'confirm' if not provided
	button?: [string?, string?] // optional labels
}

type ModalContextType = {
	open: boolean
	data: ModalData
	showModal: (data: ModalData) => Promise<boolean>
	closeModal: () => void
	confirm: () => void
	cancel: () => void
}

const ModalContext = createContext<ModalContextType | undefined>(undefined)

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const [open, setOpen] = useState(false)
	const [data, setData] = useState<ModalData>({ Title: '', Message: '' })

	const resolverRef = useRef<((value: boolean) => void) | null>(null)

	const showModal = (modalData: ModalData): Promise<boolean> => {
		setData({
			type: modalData.type ?? 'confirm',
			...modalData,
			button: modalData.button ?? ['Confirm', 'Cancel'], // fallback labels
		})
		setOpen(true)

		return new Promise<boolean>((resolve) => {
			resolverRef.current = resolve
		})
	}

	const closeModal = () => setOpen(false)

	const confirm = () => {
		resolverRef.current?.(true)
		closeModal()
	}

	const cancel = () => {
		resolverRef.current?.(false)
		closeModal()
	}

	return (
		<ModalContext.Provider value={{ open, data, showModal, closeModal, confirm, cancel }}>
		{children}
		</ModalContext.Provider>
	)
}

export const useModal = () => {
	const context = useContext(ModalContext)
	if (!context) throw new Error('useModal must be used within a ModalProvider')
	return context
}