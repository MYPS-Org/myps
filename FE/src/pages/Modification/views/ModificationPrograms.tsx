"use-client";
import React, { useState, useEffect } from 'react';

interface PaginationResponse<T> {
    Data: T[];
    TotalCount: number;
    PageSize: number;
    CurrentPage: number;
}

const ModificationPrograms: React.FC = () => {
    return (
        <div>
            <h1>Modification List</h1>
        </div>
    );
};
export default ModificationPrograms;