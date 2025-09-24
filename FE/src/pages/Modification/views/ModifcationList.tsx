"use-client";
import React, { useState, useEffect } from 'react';

interface PaginationResponse<T> {
    lists: T[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

const ModificationList: React.FC = () => {
    return (
        <div>
            <h1>Modification List</h1>
        </div>
    );
};
export default ModificationList;