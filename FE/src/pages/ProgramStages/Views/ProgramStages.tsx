"use-client";
import React, { useState, useEffect } from 'react';

const ProgramStages: React.FC = () => {
    const [stages, setStages] = useState([]);

    useEffect(() => {
        // Fetch program stages from an API or service
        fetchProgramStages();
    }, []);

    const fetchProgramStages = async () => {
        try {
            // Replace with actual API call
            const response = await fetch('/api/program-stages');
            const data = await response.json();
            setStages(data);
        } catch (error) {
            console.error('Error fetching program stages:', error);
        }
    };

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Program Stages</h1>
            <ul>
                {/* {stages.map(stage => (
                    <li key={stage.id} className="mb-2">
                        {stage.name}
                    </li>
                ))} */}
            </ul>
        </div>
    );
}

export default ProgramStages;