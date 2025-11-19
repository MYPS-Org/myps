import React, { useState } from "react";
import { type CityOption, type ProvinceOption, type LegislativeDistrictOption, cityOptions, provinceOptions, legislativeDistrictOptions } from "../../Modification/mockData/Location";

const LocationDetails: React.FC = () => {
    const [errors, setErrors] = useState<any>({});
    const [location, setLocation] = useState<any>({
        Province: '',
        City: '',
        LegislativeDistrict: ''
    });

    const handleInputChange = (field: string, value: any) => {
        setLocation((prev: any) => ({
        ...prev,
        [field]: value
        }));
    }


    return (
        <div className="space-y-4">
            <h3 className="text-lg text-left font-semibold text-gray-800 border-t-2 pt-2 border-blue-500 pb-2">
                Location Details:
            </h3>
            
            <div className="grid grid-cols-3 gap-5">
                <div className='w-full flex flex-col text-left gap-2'>
                    <div className="flex flex-row gap-5 items-center">
                        <label className="w-1/3 text-gray-600">Province:</label>
                        <select
                            value={location?.Province}
                            onChange={(e) => handleInputChange('Province', parseInt(e.target.value))}
                            className={`w-2/3 mt-1 px-3 py-2 border ${errors.Province ? 'border-red-500' : 'border-gray-300'} rounded-md truncate`}
                            style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}
                        >
                            <option value="">Select Province</option>
                            {/* <option value="1">Cavite</option>
                            <option value="2">Batangas</option>
                            <option value="3">Laguna</option> */}
                            {provinceOptions?.map((province) => (
                                <option key={province.Id} value={province.Id}>
                                    {province.ProvinceName}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className='w-full flex flex-col text-left gap-2'>
                    <div className="flex flex-row gap-5 items-center">
                        <label className={`w-1/3 ${errors.City ? 'text-red-500' : 'text-gray-600'}`}>*City/Municipality:</label>
                        <select
                            value={location?.City}
                            onChange={(e) => handleInputChange('City', parseInt(e.target.value))}
                            className={`w-2/3 mt-1 px-3 py-2 border ${errors.City ? 'border-red-500' : 'border-gray-300'} rounded-md truncate`}
                            style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}
                        >
                            <option value="">Select City/Municipality</option>
                            {cityOptions?.map((city) => (
                                <option key={city.Id} value={city.Enum}>
                                    {city.Name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className='w-full flex flex-col text-left gap-2'>
                    <div className="flex flex-row gap-5 items-center">
                        <label className={`w-1/3 ${errors.LegislativeDistrict ? 'text-red-500' : 'text-gray-600'}`}>*Legislative District:</label>
                        <select
                            value={location?.LegislativeDistrict}
                            onChange={(e) => handleInputChange('LegislativeDistrict', parseInt(e.target.value))}
                            className={`w-2/3 mt-1 px-3 py-2 border ${errors.LegislativeDistrict ? 'border-red-500' : 'border-gray-300'} rounded-md truncate`}
                            style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}
                        >
                            <option value="">Select Legislative District</option>
                            {legislativeDistrictOptions?.map((district) => (
                                <option key={district.Id} value={district.Enum}>
                                    {district.Name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LocationDetails;
