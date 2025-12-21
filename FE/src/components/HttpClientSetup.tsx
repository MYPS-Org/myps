import { useEffect } from 'react';
import { useToast } from './toaster/ToasterContext';
import { httpClient } from '../services/httpClient';

export const HttpClientSetup = () => {
    const { showToast } = useToast();

    useEffect(() => {
        httpClient.setToastCallback(showToast);
    }, [showToast]);

    return null;
};
