"use client";

import React from 'react';
import WalletForm from '../components/WalletForm';

const AddWallet: React.FC = () => {
    return (
        <div className="overflow-hidden max-w-10xl mx-auto p-6 space-y-6">
            <WalletForm mode="add" />
        </div>
    );
};

export default AddWallet;
