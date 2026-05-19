import { useEffect } from 'react';
import { useToast } from './toaster/ToasterContext';
import { httpClient, gisClient } from '../services/httpClient';

export const HttpClientSetup = () => {
    const { showToast } = useToast();

    useEffect(() => {
        httpClient.setToastCallback(showToast);
        gisClient.setToastCallback(showToast);
    }, [showToast]);

    return null;
};
