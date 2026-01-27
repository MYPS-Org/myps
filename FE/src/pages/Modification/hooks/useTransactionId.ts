import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useSetAtom } from 'jotai';
import { transactionIdAtom } from '../store/routeContextStore';

export const useTransactionId = () => {
    const { transactionId } = useParams<{ transactionId: string }>();
    const setTransactionId = useSetAtom(transactionIdAtom);

    useEffect(() => {
        if(transactionId) {
            setTransactionId(transactionId);
        }
    }, [transactionId, setTransactionId]);

    return transactionId;
}