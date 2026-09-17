"use client";

import React from 'react';
import LumpSumForm from '../components/LumpSumForm';

const AddLumpSum: React.FC = () => {
    return (
        <div className="overflow-hidden max-w-10xl mx-auto p-6 space-y-6">
            <LumpSumForm mode="add" />
        </div>
    );
};

export default AddLumpSum;
