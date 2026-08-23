import { useState } from 'react';
import { useToast } from '../../../components/toaster/ToasterContext';

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB, matches backend's max upload size

/**
 * Shared PDF-only, 50MB-max file picker used by the approval/submit/resubmit dialogs.
 * Consolidates validation that had drifted out of sync across dialogs (one copy was
 * missing the size check entirely).
 */
export function usePdfUpload() {
    const { showToast } = useToast();
    const [file, setFile] = useState<FileEntity | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (!selected) return;

        if (selected.type !== 'application/pdf') {
            showToast({
                type: 'error',
                message: 'Please select a PDF file only.'
            });
            e.target.value = '';
            return;
        }

        if (selected.size > MAX_FILE_SIZE_BYTES) {
            showToast({
                type: 'error',
                message: 'File size must not exceed 50 MB.'
            });
            e.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setFile({
                Name: selected.name,
                Extension: selected.name.split('.').pop() || '',
                ContentType: selected.type,
                DataUrl: reader.result as string,
            });
        };
        reader.readAsDataURL(selected);
    };

    const reset = () => setFile(null);

    return { file, setFile, handleFileChange, reset };
}
